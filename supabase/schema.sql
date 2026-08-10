create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  mode text not null check (mode in ('duo','event')),
  games jsonb not null default '[]'::jsonb,
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  current_game int not null default 0,
  max_attempts int not null default 3,
  created_at timestamptz not null default now()
);

alter table public.rooms add column if not exists max_attempts int not null default 3;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  game_id text not null,
  attempt int not null default 1,
  raw_score numeric not null,
  display_score text not null,
  points int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.scores enable row level security;

drop policy if exists "public rooms read" on public.rooms;
drop policy if exists "public rooms insert" on public.rooms;
drop policy if exists "public rooms update" on public.rooms;
drop policy if exists "public players read" on public.players;
drop policy if exists "public players insert" on public.players;
drop policy if exists "public players update" on public.players;
drop policy if exists "public scores read" on public.scores;
drop policy if exists "public scores insert" on public.scores;
drop policy if exists "public scores update" on public.scores;

create policy "public rooms read" on public.rooms for select using (true);
create policy "public rooms insert" on public.rooms for insert with check (true);
create policy "public rooms update" on public.rooms for update using (true) with check (true);
create policy "public players read" on public.players for select using (true);
create policy "public players insert" on public.players for insert with check (true);
create policy "public players update" on public.players for update using (true) with check (true);
create policy "public scores read" on public.scores for select using (true);
create policy "public scores insert" on public.scores for insert with check (true);
create policy "public scores update" on public.scores for update using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; end $$;
