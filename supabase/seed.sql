insert into players (name, total_championship_points, sessions_played)
values
  ('Siva', 63, 0),
  ('Thush', 60, 0),
  ('Nishan', 44, 0),
  ('Thambi', 34, 0),
  ('Sam', 33, 0),
  ('Hursh', 27, 0),
  ('Abi', 26, 0),
  ('Jayson', 20, 0)
on conflict (name) do update
set total_championship_points = excluded.total_championship_points;

insert into championship_history (player_id, points, reason, metadata)
select id, total_championship_points, 'initial_seed', jsonb_build_object('label', 'Existing championship standings')
from players
where name in ('Siva', 'Thush', 'Nishan', 'Thambi', 'Sam', 'Hursh', 'Abi', 'Jayson')
on conflict do nothing;
