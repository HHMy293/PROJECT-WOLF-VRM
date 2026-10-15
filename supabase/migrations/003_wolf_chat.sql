-- WOLF 0.4.0: additive migration; preserves rooms, players, games and secrets.
begin;
create table if not exists public.wolf_chat_messages (
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.wolf_games(id),
 player_id uuid not null references public.wolf_players(id),
 sender_name text not null,
 channel text not null check(channel in ('living','dead','end')),
 kind text not null check(kind in ('text','sticker')),
 body text not null check(char_length(body) between 1 and 500),
 nonce uuid not null,
 created_at timestamptz not null default now(),
 unique(game_id,player_id,nonce)
);
create index if not exists wolf_chat_game_time on public.wolf_chat_messages(game_id,created_at desc,id);
create index if not exists wolf_chat_player_time on public.wolf_chat_messages(player_id,created_at desc);
alter table public.wolf_chat_messages enable row level security;
revoke all on public.wolf_chat_messages from public,anon,authenticated;
grant select on public.wolf_chat_messages to authenticated;
grant all on public.wolf_chat_messages to service_role;

-- Reads use the server's public snapshot, never disclose secret roles.
create or replace function wolf_private.chat_visible(p_game uuid,p_channel text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.wolf_games g
  join public.wolf_players p on p.room_id=g.room_id and p.user_id=auth.uid() and p.left_at is null and not p.banned
  join lateral jsonb_array_elements(g.snapshot->'players') gp on gp->>'id'=p.id::text
  where g.id=p_game and (
   g.snapshot->>'phase'='game_over'
   or p_channel='living'
   or (p_channel='dead' and (gp->>'alive')::boolean=false)
  )
 );
$$;
revoke all on function wolf_private.chat_visible(uuid,text) from public,anon;
grant execute on function wolf_private.chat_visible(uuid,text) to authenticated;
drop policy if exists wolf_chat_read on public.wolf_chat_messages;
create policy wolf_chat_read on public.wolf_chat_messages for select to authenticated
 using(wolf_private.chat_visible(game_id,channel));

create or replace function public.wolf_send_chat(p_game uuid,p_body text,p_kind text,p_nonce uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.wolf_games; r public.wolf_rooms; p public.wolf_players;
 gp jsonb; destination text; existing uuid; result uuid; clean text;
begin
 if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
 if p_nonce is null or p_kind is null or p_kind not in ('text','sticker') then raise exception 'Tin nhắn không hợp lệ.'; end if;
 clean:=btrim(p_body);
 if clean is null or char_length(clean) not between 1 and 500 then raise exception 'Tin nhắn cần từ 1 đến 500 ký tự.'; end if;
 if p_kind='sticker' and clean not in ('wolf','moon','detective','shield','potion','victory','ghost','fire') then raise exception 'Sticker không hợp lệ.'; end if;
 -- Serializes sends from one identity and game transitions/rematches via the room lock.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 31));
 select * into g from public.wolf_games where id=p_game;
 if not found then raise exception 'Ván không tồn tại.'; end if;
 select * into r from public.wolf_rooms where id=g.room_id for update;
 if r.game_id is distinct from p_game or r.status not in ('playing','finished') then raise exception 'Ván đã thay đổi. Hãy tải lại chat.'; end if;
 -- Re-read after obtaining the room lock: don't use stale alive/phase data.
 select * into g from public.wolf_games where id=p_game;
 select * into p from public.wolf_players where room_id=g.room_id and user_id=auth.uid() and left_at is null and not banned;
 if not found then raise exception 'Bạn không thuộc phòng này.'; end if;
 select value into gp from jsonb_array_elements(g.snapshot->'players') where value->>'id'=p.id::text;
 if gp is null then raise exception 'Bạn không thuộc ván này.'; end if;
 select id into existing from public.wolf_chat_messages where game_id=p_game and player_id=p.id and nonce=p_nonce;
 if existing is not null then return existing; end if;
 if g.snapshot->>'phase'='game_over' then destination:='end';
 elsif (gp->>'alive')::boolean=false then destination:='dead';
 elsif g.snapshot->>'phase' in ('discussion','voting','vote_result','morning','win_check') then destination:='living';
 else raise exception 'Chat người sống tạm khóa ban đêm và khi nhận vai.';
 end if;
 if exists(select 1 from public.wolf_chat_messages where player_id=p.id and created_at>now()-interval '2 seconds') then raise exception 'Chờ 2 giây trước khi gửi tiếp.'; end if;
 if (select count(*) from public.wolf_chat_messages where game_id=p_game and player_id=p.id and created_at>now()-interval '10 minutes')>=60 then raise exception 'Bạn đã gửi nhiều tin. Hãy chờ thêm.'; end if;
 insert into public.wolf_chat_messages(game_id,player_id,sender_name,channel,kind,body,nonce)
 values(p_game,p.id,p.name,destination,p_kind,clean,p_nonce) returning id into result;
 return result;
end;
$$;
revoke all on function public.wolf_send_chat(uuid,text,text,uuid) from public,anon;
grant execute on function public.wolf_send_chat(uuid,text,text,uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wolf_chat_messages'
 ) then alter publication supabase_realtime add table public.wolf_chat_messages; end if;
end $$;
commit;
