-- PROJECT WOLF • Bước 2: game engine + bot thử. Chạy sau migration 001.
begin;
alter table public.wolf_rooms drop constraint if exists wolf_rooms_status_check;
alter table public.wolf_rooms add constraint wolf_rooms_status_check check(status in ('waiting','playing','finished','closed'));
alter table public.wolf_rooms add column if not exists game_id uuid;
alter table public.wolf_rooms add column if not exists test_mode boolean not null default false;
alter table public.wolf_players alter column user_id drop not null;
alter table public.wolf_players add column if not exists bot boolean not null default false;
alter table public.wolf_players add column if not exists last_seen_at timestamptz not null default now();

alter table public.wolf_players drop constraint if exists wolf_player_identity_check;
alter table public.wolf_players add constraint wolf_player_identity_check
 check((bot and user_id is null) or (not bot and user_id is not null));
create or replace function wolf_private.bot_ready() returns trigger language plpgsql set search_path='' as $$
begin
 if new.bot then new.ready := (new.left_at is null); end if;
 return new;
end; $$;
revoke all on function wolf_private.bot_ready() from public,anon,authenticated;
drop trigger if exists wolf_bot_ready on public.wolf_players;
create trigger wolf_bot_ready before insert or update on public.wolf_players for each row execute function wolf_private.bot_ready();

create table if not exists public.wolf_games (
 id uuid primary key, room_id uuid not null references public.wolf_rooms(id),
 snapshot jsonb not null, version bigint not null default 1, created_at timestamptz not null default now()
);
create table if not exists public.wolf_game_secrets (
 game_id uuid primary key references public.wolf_games(id), state jsonb not null,
 version bigint not null default 1
);
alter table public.wolf_games enable row level security;
alter table public.wolf_game_secrets enable row level security;
revoke all on public.wolf_games, public.wolf_game_secrets from public, anon, authenticated;
grant select on public.wolf_games to authenticated;
grant all on public.wolf_games, public.wolf_game_secrets, public.wolf_rooms, public.wolf_players to service_role;
drop policy if exists wolf_game_members_read on public.wolf_games;
create policy wolf_game_members_read on public.wolf_games for select to authenticated using(wolf_private.is_member(room_id));
-- wolf_game_secrets KHÔNG có policy cho authenticated, KHÔNG đưa vào publication.
create or replace function public.wolf_enter_room(
  p_name text, p_code text default null, p_capacity integer default 8,
  p_mode text default 'quick', p_avatar integer default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r public.wolf_rooms; existing public.wolf_players;
  new_code text; attempts integer := 0;
begin
  if u is null then raise exception 'Bạn cần đăng nhập trước.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 0));
  if p_name is null or char_length(btrim(p_name)) not between 1 and 24 then
    raise exception 'Tên phải có từ 1 đến 24 ký tự.';
  end if;
  if p_avatar is null or p_avatar not between 0 and 5 then raise exception 'Ảnh đại diện không hợp lệ.'; end if;
  if p_code is null then
    if exists (select 1 from public.wolf_players where user_id = u and left_at is null) then
      raise exception 'Hãy rời phòng hiện tại trước khi tạo phòng mới.';
    end if;
    if p_capacity is null or p_capacity not between 6 and 12 or p_mode is null or p_mode not in ('quick', 'classic') then
      raise exception 'Thiết lập phòng không hợp lệ.';
    end if;
    loop
      new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      begin
        insert into public.wolf_rooms(code, host_id, capacity, mode, roles)
          values(new_code, u, p_capacity, p_mode, wolf_private.preset(p_capacity)) returning * into r;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts >= 10 then raise exception 'Chưa tạo được mã phòng. Hãy thử lại.'; end if;
      end;
    end loop;
  else
    if upper(btrim(p_code)) !~ '^[A-Z0-9]{6}$' then raise exception 'Mã phòng gồm 6 chữ hoặc số.'; end if;
    select * into r from public.wolf_rooms where code = upper(btrim(p_code)) for update;
    if not found or r.status not in ('waiting', 'playing', 'finished') then raise exception 'Phòng không tồn tại hoặc đã đóng.'; end if;
    select * into existing from public.wolf_players where room_id = r.id and user_id = u;
    if found and existing.banned then raise exception 'Bạn đã bị chủ phòng đưa ra khỏi phòng này.'; end if;
    if exists(select 1 from public.wolf_players where user_id = u and left_at is null and room_id <> r.id) then
      raise exception 'Hãy rời phòng hiện tại trước khi tham gia phòng khác.';
    end if;
    if existing.id is not null and existing.left_at is null then return r.id; end if;
    if r.status <> 'waiting' then
      if existing.id is null then raise exception 'Trận đã bắt đầu. Chỉ người chơi của ván được quay lại.'; end if;
      update public.wolf_players set left_at = null where id = existing.id;
      update public.wolf_rooms set revision = revision + 1 where id = r.id;
      return r.id;
    end if;
    if (select count(*) from public.wolf_players where room_id = r.id and left_at is null) >= r.capacity then
      raise exception 'Phòng đã đủ người.';
    end if;
  end if;
  insert into public.wolf_players(room_id, user_id, name, avatar)
    values(r.id, u, btrim(p_name), p_avatar)
    on conflict (room_id, user_id) do update set
      name = excluded.name, avatar = excluded.avatar, left_at = null, ready = false, joined_at = now();
  update public.wolf_rooms set revision = revision + 1 where id = r.id;
  return r.id;
end;
$$;

create or replace function public.wolf_leave_room(p_room uuid, p_target uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); target_id uuid := coalesce(p_target, auth.uid());
  r public.wolf_rooms; next_host uuid;
begin
  select * into r from public.wolf_rooms where id = p_room for update;
  if u is null or not found or r.status not in ('waiting', 'playing', 'finished') or not wolf_private.is_member(p_room) then
    raise exception 'Bạn không ở trong sảnh chờ này.';
  end if;
  if target_id <> u and r.status <> 'waiting' then raise exception 'Không được mời người ra khi ván đã bắt đầu.'; end if;
  if target_id <> u and r.host_id <> u then raise exception 'Chỉ chủ phòng được đưa người khác ra.'; end if;
  update public.wolf_players set left_at = now(), ready = false, banned = (target_id <> u)
    where room_id = p_room and user_id = target_id and left_at is null;
  if not found then raise exception 'Người chơi không còn trong phòng.'; end if;
  if target_id = r.host_id then
    select user_id into next_host from public.wolf_players where room_id = p_room and left_at is null and not bot
      order by joined_at, id limit 1;
    if next_host is null then
      update public.wolf_rooms set status = 'closed' where id = p_room;
    else
      update public.wolf_rooms set host_id = next_host where id = p_room;
    end if;
  end if;
  update public.wolf_rooms set revision = revision + 1 where id = p_room;
end;
$$;

create or replace function public.wolf_test_bots(p_room uuid, p_fill boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.wolf_rooms; n integer; i integer; bot_count integer;
begin
 select * into r from public.wolf_rooms where id=p_room for update;
 if not found or auth.uid() is null or r.host_id <> auth.uid() or r.status <> 'waiting' or not wolf_private.is_member(p_room) then raise exception 'Chỉ chủ phòng được chỉnh bot trong sảnh chờ.'; end if;
 if p_fill is null then raise exception 'Thiết lập bot không hợp lệ.'; end if;
 if p_fill then
  select count(*) into n from public.wolf_players where room_id=p_room and left_at is null;
  select count(*) into bot_count from public.wolf_players where room_id=p_room and bot and left_at is null;
  for i in 1..(r.capacity-n) loop
   insert into public.wolf_players(room_id,user_id,name,avatar,ready,bot) values(p_room,null,'Bot ' || (bot_count+i), (bot_count+i-1)%6,true,true);
  end loop;
  update public.wolf_rooms set test_mode=true,revision=revision+1 where id=p_room;
 else
  update public.wolf_players set left_at=now() where room_id=p_room and bot and left_at is null;
  update public.wolf_rooms set test_mode=false,revision=revision+1 where id=p_room;
 end if;
end; $$;
revoke all on function public.wolf_test_bots(uuid,boolean) from public,anon;
grant execute on function public.wolf_test_bots(uuid,boolean) to authenticated;

create or replace function public.wolf_engine_start(p_room uuid,p_user uuid,p_revision bigint,p_id uuid,p_state jsonb,p_snapshot jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.wolf_rooms;
begin
 select * into r from public.wolf_rooms where id=p_room for update;
 if not found or r.host_id <> p_user or not exists(select 1 from public.wolf_players where room_id=p_room and user_id=p_user and left_at is null) then raise exception 'Chỉ chủ phòng được bắt đầu ván.'; end if;
 if r.status <> 'waiting' or r.revision <> p_revision then return false; end if;
 if (select count(*) from public.wolf_players where room_id=p_room and left_at is null) <> r.capacity then raise exception 'Hãy mời đủ người hoặc thêm bot thử.'; end if;
 if exists(select 1 from public.wolf_players where room_id=p_room and left_at is null and not ready) then raise exception 'Tất cả người chơi phải sẵn sàng.'; end if;
 insert into public.wolf_games(id,room_id,snapshot) values(p_id,p_room,p_snapshot);
 insert into public.wolf_game_secrets(game_id,state) values(p_id,p_state);
 update public.wolf_rooms set status='playing',game_id=p_id,revision=revision+1 where id=p_room;
 return true;
end; $$;
create or replace function public.wolf_engine_commit(p_id uuid,p_version bigint,p_state jsonb,p_snapshot jsonb,p_finished boolean,p_actor uuid default null,p_host_action boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare v bigint; r uuid; status_now text;
begin
 select room_id into r from public.wolf_games where id=p_id;
 if r is null then return false; end if;
 select status into status_now from public.wolf_rooms where id=r and game_id=p_id for update;
 if not found then return false; end if;
 if p_actor is not null and not exists(select 1 from public.wolf_players where room_id=r and user_id=p_actor and left_at is null) then raise exception 'Bạn đã rời phòng.'; end if;
 if p_host_action and not exists(select 1 from public.wolf_rooms where id=r and host_id=p_actor) then raise exception 'Quyền chủ phòng đã thay đổi.'; end if;
 if status_now not in ('playing','finished') then return false; end if;
 select version into v from public.wolf_game_secrets where game_id=p_id for update;
 if v <> p_version then return false; end if;
 update public.wolf_game_secrets set state=p_state,version=version+1 where game_id=p_id;
 update public.wolf_games set snapshot=p_snapshot,version=version+1 where id=p_id;
 if p_finished then update public.wolf_rooms set status='finished',revision=revision+1 where id=r and status='playing'; end if;
 return true;
end; $$;
create or replace function public.wolf_rematch(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.wolf_rooms;
begin
 select * into r from public.wolf_rooms where id=p_room for update;
 if not found or auth.uid() is null or r.host_id <> auth.uid() or r.status <> 'finished' or not wolf_private.is_member(p_room) then raise exception 'Chỉ chủ phòng được mở ván mới sau khi ván kết thúc.'; end if;
 update public.wolf_rooms set status='waiting',game_id=null,revision=revision+1 where id=p_room;
 update public.wolf_players set ready=bot where room_id=p_room and left_at is null;
end; $$;
revoke all on function public.wolf_rematch(uuid) from public,anon;
grant execute on function public.wolf_rematch(uuid) to authenticated;

-- Heartbeat có kiểm tra thành viên, chuyển host sau 90 giây không hoạt động.
create or replace function public.wolf_heartbeat(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.wolf_rooms; next_user uuid;
begin
 select * into r from public.wolf_rooms where id=p_room for update;
 if not found or auth.uid() is null or r.status='closed' or not wolf_private.is_member(p_room) then return; end if;
 update public.wolf_players set last_seen_at=now() where room_id=p_room and user_id=auth.uid() and left_at is null;
 if not exists(select 1 from public.wolf_players where room_id=p_room and user_id=r.host_id and left_at is null and last_seen_at > now()-interval '90 seconds') then
  select user_id into next_user from public.wolf_players where room_id=p_room and left_at is null and not bot and last_seen_at > now()-interval '60 seconds' order by joined_at,id limit 1;
  if next_user is not null and next_user <> r.host_id then update public.wolf_rooms set host_id=next_user,revision=revision+1 where id=p_room; end if;
 end if;
end; $$;
revoke all on function public.wolf_heartbeat(uuid) from public,anon;
grant execute on function public.wolf_heartbeat(uuid) to authenticated;

revoke all on function public.wolf_engine_start(uuid,uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.wolf_engine_commit(uuid,bigint,jsonb,jsonb,boolean,uuid,boolean) from public,anon,authenticated;
grant execute on function public.wolf_engine_start(uuid,uuid,bigint,uuid,jsonb,jsonb) to service_role;
grant execute on function public.wolf_engine_commit(uuid,bigint,jsonb,jsonb,boolean,uuid,boolean) to service_role;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wolf_games') then alter publication supabase_realtime add table public.wolf_games; end if;
end; $$;
commit;
