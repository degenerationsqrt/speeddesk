create table if not exists public.team_snapshots (
  team_id text primary key,
  team_name text not null,
  invite_code text not null unique,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.team_snapshots enable row level security;

-- Starter policy for a private prototype. Tighten this with Supabase Auth before
-- collecting sensitive athlete information or publishing a public invite link.
create policy "team snapshots prototype read"
  on public.team_snapshots
  for select
  using (true);

create policy "team snapshots prototype write"
  on public.team_snapshots
  for insert
  with check (true);

create policy "team snapshots prototype update"
  on public.team_snapshots
  for update
  using (true)
  with check (true);
