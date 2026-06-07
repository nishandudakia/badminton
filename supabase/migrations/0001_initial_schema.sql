create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  nickname text,
  is_guest boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  total_championship_points integer not null default 0,
  sessions_played integer not null default 0
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  target_score integer not null default 15 check (target_score > 0),
  court_count integer not null default 1 check (court_count > 0),
  player_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'draft' check (status in ('draft', 'active', 'finalized')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  import_source text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  match_number integer not null,
  court_number integer not null default 1,
  team_a_player_ids uuid[] not null,
  team_b_player_ids uuid[] not null,
  bye_player_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'scheduled' check (status in ('scheduled', 'complete')),
  created_at timestamptz not null default now(),
  unique (session_id, match_number)
);

create table if not exists match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  team_a_score integer not null default 0 check (team_a_score >= 0),
  team_b_score integer not null default 0 check (team_b_score >= 0),
  override_target boolean not null default false,
  admin_note text,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  session_points integer not null default 0,
  position integer not null,
  championship_points_awarded integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  matches_played integer not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create table if not exists championship_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  points integer not null,
  reason text not null default 'session_award',
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists players_archived_at_idx on players(archived_at);
create index if not exists sessions_session_date_idx on sessions(session_date desc);
create index if not exists matches_session_id_idx on matches(session_id);
create index if not exists session_results_session_id_idx on session_results(session_id);
create index if not exists championship_history_player_id_idx on championship_history(player_id);
create index if not exists championship_history_session_id_idx on championship_history(session_id);

alter table players enable row level security;
alter table sessions enable row level security;
alter table matches enable row level security;
alter table match_scores enable row level security;
alter table session_results enable row level security;
alter table championship_history enable row level security;

create policy "Allow MVP reads" on players for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP writes" on players for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));

create policy "Allow MVP session reads" on sessions for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP session writes" on sessions for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));

create policy "Allow MVP match reads" on matches for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP match writes" on matches for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));

create policy "Allow MVP score reads" on match_scores for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP score writes" on match_scores for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));

create policy "Allow MVP result reads" on session_results for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP result writes" on session_results for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));

create policy "Allow MVP history reads" on championship_history for select using (auth.role() in ('anon', 'authenticated'));
create policy "Allow MVP history writes" on championship_history for all using (auth.role() in ('anon', 'authenticated')) with check (auth.role() in ('anon', 'authenticated'));
