-- PROJECT WOLF • Bước 1: sảnh chờ thật. Chạy toàn bộ trong Supabase SQL Editor.
-- Không chia vai hoặc chạy ván đấu trong migration này.
-- Có thể chạy lại: không xóa phòng hoặc người chơi hiện có.
begin;

create schema if not exists wolf_private;
revoke all on schema wolf_private from public, anon, authenticated;
grant usage on schema wolf_private to authenticated;

create table if not exists public.wolf_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id),
  status text not null default 'waiting' check (status in ('waiting', 'closed')),
  mode text not null default 'quick' check (mode in ('quick', 'classic')),
  capacity integer not null default 8 check (capacity between 6 and 12),
  roles jsonb not null,
  config_mode text not null default 'preset' check (config_mode in ('preset', 'custom')),
  reveal_dead boolean not null default false,
  revision bigint not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.wolf_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.wolf_rooms(id),
  user_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 24),
  avatar integer not null default 0 check (avatar between 0 and 5),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  banned boolean not null default false,
  unique (room_id, user_id)
);
create index if not exists wolf_players_room_idx on public.wolf_players(room_id);
create unique index if not exists wolf_one_active_room_per_user
  on public.wolf_players(user_id) where left_at is null;

alter table public.wolf_rooms enable row level security;
alter table public.wolf_players enable row level security;
revoke all on public.wolf_rooms, public.wolf_players from public, anon, authenticated;
grant select on public.wolf_rooms, public.wolf_players to authenticated;

create or replace function wolf_private.is_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.wolf_players
    where room_id = p_room and user_id = auth.uid() and left_at is null);
$$;
revoke all on function wolf_private.is_member(uuid) from public, anon;
grant execute on function wolf_private.is_member(uuid) to authenticated;
drop policy if exists wolf_room_members_read on public.wolf_rooms;
create policy wolf_room_members_read on public.wolf_rooms
  for select to authenticated using (wolf_private.is_member(id));
drop policy if exists wolf_player_members_read on public.wolf_players;
create policy wolf_player_members_read on public.wolf_players
  for select to authenticated using (wolf_private.is_member(room_id));

create or replace function wolf_private.preset(n integer)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('wolf', case when n >= 10 then 3 else 2 end,
    'seer', 1, 'witch', 1, 'guard', case when n >= 7 then 1 else 0 end,
    'hunter', case when n >= 8 then 1 else 0 end,
    'villager', n - case when n >= 10 then 3 else 2 end - 2
      - case when n >= 7 then 1 else 0 end - case when n >= 8 then 1 else 0 end);
$$;
revoke all on function wolf_private.preset(integer) from public, anon, authenticated;

-- Advisory lock theo user + khóa dòng phòng: tránh tham gia đồng thời vượt số chỗ.
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
    if not found or r.status <> 'waiting' then raise exception 'Phòng không tồn tại hoặc đã đóng.'; end if;
    select * into existing from public.wolf_players where room_id = r.id and user_id = u;
    if found and existing.banned then raise exception 'Bạn đã bị chủ phòng đưa ra khỏi phòng này.'; end if;
    if exists(select 1 from public.wolf_players where user_id = u and left_at is null and room_id <> r.id) then
      raise exception 'Hãy rời phòng hiện tại trước khi tham gia phòng khác.';
    end if;
    if existing.id is not null and existing.left_at is null then return r.id; end if;
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

create or replace function public.wolf_set_ready(p_room uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.wolf_rooms;
begin
  select * into r from public.wolf_rooms where id = p_room for update;
  if not found or r.status <> 'waiting' or not wolf_private.is_member(p_room) then
    raise exception 'Bạn không ở trong sảnh chờ này.';
  end if;
  if p_ready is null then raise exception 'Trạng thái sẵn sàng không hợp lệ.'; end if;
  update public.wolf_players set ready = p_ready where room_id = p_room and user_id = auth.uid() and left_at is null;
  update public.wolf_rooms set revision = revision + 1 where id = p_room;
end;
$$;

create or replace function public.wolf_save_settings(
  p_room uuid, p_capacity integer, p_mode text, p_roles jsonb,
  p_config_mode text, p_reveal_dead boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare r public.wolf_rooms; v_roles jsonb; k text; total integer := 0; v integer;
begin
  select * into r from public.wolf_rooms where id = p_room for update;
  if not found or r.status <> 'waiting' or r.host_id <> auth.uid() or not wolf_private.is_member(p_room) then
    raise exception 'Chỉ chủ phòng được sửa thiết lập.';
  end if;
  if p_capacity is null or p_capacity not between 6 and 12
    or p_mode is null or p_mode not in ('quick', 'classic')
    or p_config_mode is null or p_config_mode not in ('preset', 'custom') or p_reveal_dead is null then
    raise exception 'Thiết lập không hợp lệ.';
  end if;
  if p_capacity < (select count(*) from public.wolf_players where room_id = p_room and left_at is null) then
    raise exception 'Không thể giảm số chỗ thấp hơn số người đang trong phòng.';
  end if;
  v_roles := case when p_config_mode = 'preset' then wolf_private.preset(p_capacity) else p_roles end;
  if v_roles is null or jsonb_typeof(v_roles) <> 'object' then raise exception 'Bộ vai trò không hợp lệ.'; end if;
  if (select count(*) from jsonb_object_keys(v_roles)) <> 6 then raise exception 'Bộ vai trò phải có đúng 6 loại.'; end if;
  foreach k in array array['wolf','villager','seer','witch','guard','hunter'] loop
    if not (v_roles ? k) or jsonb_typeof(v_roles -> k) <> 'number'
      or (v_roles ->> k) !~ '^[0-9]{1,2}$' then raise exception 'Số lượng vai trò không hợp lệ.'; end if;
    v := (v_roles ->> k)::integer;
    if v > 12 then raise exception 'Số lượng vai trò không hợp lệ.'; end if;
    total := total + v;
  end loop;
  if total <> p_capacity or (v_roles ->> 'wolf')::integer < 1
    or (v_roles ->> 'wolf')::integer * 2 >= p_capacity then
    raise exception 'Tổng thẻ phải bằng số chỗ; Sói phải có ít nhất 1 và ít hơn nửa phòng.';
  end if;
  update public.wolf_rooms set capacity = p_capacity, mode = p_mode, roles = v_roles,
    config_mode = p_config_mode, reveal_dead = p_reveal_dead, revision = revision + 1 where id = p_room;
  update public.wolf_players set ready = false where room_id = p_room and left_at is null;
end;
$$;

-- Rời phòng tự nguyện hoặc chủ phòng mời một người ra. Không phát sự kiện DELETE.
create or replace function public.wolf_leave_room(p_room uuid, p_target uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); target_id uuid := coalesce(p_target, auth.uid());
  r public.wolf_rooms; next_host uuid;
begin
  select * into r from public.wolf_rooms where id = p_room for update;
  if u is null or not found or r.status <> 'waiting' or not wolf_private.is_member(p_room) then
    raise exception 'Bạn không ở trong sảnh chờ này.';
  end if;
  if target_id <> u and r.host_id <> u then raise exception 'Chỉ chủ phòng được đưa người khác ra.'; end if;
  update public.wolf_players set left_at = now(), ready = false, banned = (target_id <> u)
    where room_id = p_room and user_id = target_id and left_at is null;
  if not found then raise exception 'Người chơi không còn trong phòng.'; end if;
  if target_id = r.host_id then
    select user_id into next_host from public.wolf_players where room_id = p_room and left_at is null
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

revoke all on function public.wolf_enter_room(text,text,integer,text,integer) from public, anon;
revoke all on function public.wolf_set_ready(uuid,boolean) from public, anon;
revoke all on function public.wolf_save_settings(uuid,integer,text,jsonb,text,boolean) from public, anon;
revoke all on function public.wolf_leave_room(uuid,uuid) from public, anon;
grant execute on function public.wolf_enter_room(text,text,integer,text,integer) to authenticated;
grant execute on function public.wolf_set_ready(uuid,boolean) to authenticated;
grant execute on function public.wolf_save_settings(uuid,integer,text,jsonb,text,boolean) to authenticated;
grant execute on function public.wolf_leave_room(uuid,uuid) to authenticated;

-- Chỉ đưa dữ liệu sảnh chờ vào Realtime; không chứa vai trò được chia hoặc phiếu bí mật.
do $$
declare t text;
begin
  foreach t in array array['wolf_rooms', 'wolf_players'] loop
    if not exists(select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
commit;
