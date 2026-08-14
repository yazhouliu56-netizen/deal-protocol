-- Cross-device shared broadcast space for the P2P waves line.
-- Single JSONB row; any tab/device upserts the whole shared state and all
-- clients sync via Realtime postgres_changes.
create table public.p2p_broadcast (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);

alter table public.p2p_broadcast enable row level security;

create policy "p2p anon read"
  on public.p2p_broadcast for select using (true);
create policy "p2p anon insert"
  on public.p2p_broadcast for insert with check (true);
create policy "p2p anon update"
  on public.p2p_broadcast for update using (true);

-- Enable Realtime for the table in the dashboard claims:
--   Supabase > Database > Replication > enable "p2p_broadcast".
-- Load once:
--   insert into public.p2p_broadcast (id, state) values ('oto', '{}'::jsonb);