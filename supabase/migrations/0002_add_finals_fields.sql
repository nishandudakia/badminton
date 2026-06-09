alter table sessions
  add column if not exists include_finals boolean not null default true,
  add column if not exists finals_count_towards_leaderboard boolean not null default true;

alter table matches
  add column if not exists round_number integer,
  add column if not exists is_final boolean not null default false;
