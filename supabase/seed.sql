with player_seed (name, id) as (
  values
    ('Siva', '00000000-0000-4000-8000-000000000001'::uuid),
    ('Thush', '00000000-0000-4000-8000-000000000002'::uuid),
    ('Nishan', '00000000-0000-4000-8000-000000000003'::uuid),
    ('Thambi', '00000000-0000-4000-8000-000000000004'::uuid),
    ('Sam', '00000000-0000-4000-8000-000000000005'::uuid),
    ('Hursh', '00000000-0000-4000-8000-000000000006'::uuid),
    ('Abi', '00000000-0000-4000-8000-000000000007'::uuid),
    ('Jayson', '00000000-0000-4000-8000-000000000008'::uuid)
),
round_seed (round_number, scores) as (
  values
    (1, '{"Siva":7,"Sam":6,"Jayson":5,"Thush":4,"Abi":4,"Thambi":3,"Hursh":2,"Nishan":2}'::jsonb),
    (2, '{"Sam":13,"Siva":12,"Thush":12,"Thambi":10,"Jayson":7,"Nishan":6,"Hursh":5,"Abi":5}'::jsonb),
    (3, '{"Siva":16,"Thush":14,"Thambi":13,"Sam":13,"Jayson":7,"Nishan":7,"Hursh":5,"Abi":5}'::jsonb),
    (4, '{"Siva":21,"Thush":18,"Sam":16,"Thambi":14,"Jayson":7,"Nishan":7,"Hursh":7,"Abi":5}'::jsonb),
    (5, '{"Thush":24,"Siva":22,"Sam":19,"Thambi":17,"Hursh":14,"Nishan":12,"Abi":10,"Jayson":7}'::jsonb),
    (6, '{"Siva":29,"Thush":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (7, '{"Thush":29,"Siva":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (8, '{"Thush":38,"Siva":37,"Sam":23,"Thambi":23,"Nishan":20,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (9, '{"Thush":40,"Siva":37,"Thambi":24,"Nishan":23,"Sam":23,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (10, '{"Thush":44,"Siva":42,"Nishan":26,"Thambi":25,"Sam":23,"Abi":16,"Hursh":15,"Jayson":15}'::jsonb),
    (11, '{"Siva":54,"Thush":50,"Nishan":33,"Thambi":32,"Sam":23,"Hursh":21,"Jayson":20,"Abi":16}'::jsonb),
    (12, '{"Siva":63,"Thush":60,"Nishan":44,"Thambi":34,"Sam":33,"Hursh":27,"Abi":26,"Jayson":20}'::jsonb)
),
latest_scores as (
  select scores from round_seed where round_number = 12
)
insert into players (id, name, total_championship_points, sessions_played, created_at)
select
  player_seed.id,
  player_seed.name,
  (latest_scores.scores ->> player_seed.name)::integer,
  12,
  '2026-06-07T00:00:00.000Z'::timestamptz
from player_seed
cross join latest_scores
on conflict (name) do update
set
  total_championship_points = excluded.total_championship_points,
  sessions_played = excluded.sessions_played;

delete from sessions
where id in (
  select ('20000000-0000-4000-8000-' || lpad(round_number::text, 12, '0'))::uuid
  from (
    values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)
  ) as rounds(round_number)
);

delete from championship_history
where metadata ->> 'source' = 'round-score-reference-v1'
  or metadata ->> 'label' = 'Existing championship standings';

with player_seed as (
  select name, id
  from players
  where name in ('Siva', 'Thush', 'Nishan', 'Thambi', 'Sam', 'Hursh', 'Abi', 'Jayson')
),
round_seed (round_number, scores) as (
  values
    (1, '{"Siva":7,"Sam":6,"Jayson":5,"Thush":4,"Abi":4,"Thambi":3,"Hursh":2,"Nishan":2}'::jsonb),
    (2, '{"Sam":13,"Siva":12,"Thush":12,"Thambi":10,"Jayson":7,"Nishan":6,"Hursh":5,"Abi":5}'::jsonb),
    (3, '{"Siva":16,"Thush":14,"Thambi":13,"Sam":13,"Jayson":7,"Nishan":7,"Hursh":5,"Abi":5}'::jsonb),
    (4, '{"Siva":21,"Thush":18,"Sam":16,"Thambi":14,"Jayson":7,"Nishan":7,"Hursh":7,"Abi":5}'::jsonb),
    (5, '{"Thush":24,"Siva":22,"Sam":19,"Thambi":17,"Hursh":14,"Nishan":12,"Abi":10,"Jayson":7}'::jsonb),
    (6, '{"Siva":29,"Thush":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (7, '{"Thush":29,"Siva":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (8, '{"Thush":38,"Siva":37,"Sam":23,"Thambi":23,"Nishan":20,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (9, '{"Thush":40,"Siva":37,"Thambi":24,"Nishan":23,"Sam":23,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (10, '{"Thush":44,"Siva":42,"Nishan":26,"Thambi":25,"Sam":23,"Abi":16,"Hursh":15,"Jayson":15}'::jsonb),
    (11, '{"Siva":54,"Thush":50,"Nishan":33,"Thambi":32,"Sam":23,"Hursh":21,"Jayson":20,"Abi":16}'::jsonb),
    (12, '{"Siva":63,"Thush":60,"Nishan":44,"Thambi":34,"Sam":33,"Hursh":27,"Abi":26,"Jayson":20}'::jsonb)
),
session_rows as (
  select
    round_number,
    ('20000000-0000-4000-8000-' || lpad(round_number::text, 12, '0'))::uuid as session_id,
    scores,
    ('2026-01-' || lpad(round_number::text, 2, '0') || 'T00:00:00.000Z')::timestamptz as awarded_at
  from round_seed
),
session_players as (
  select
    session_rows.round_number,
    session_rows.session_id,
    session_rows.scores,
    session_rows.awarded_at,
    array_agg(player_seed.id order by player_seed.name) as player_ids
  from session_rows
  join jsonb_each_text(session_rows.scores) as score_entry(name, score) on true
  join player_seed on player_seed.name = score_entry.name
  group by session_rows.round_number, session_rows.session_id, session_rows.scores, session_rows.awarded_at
)
insert into sessions (
  id,
  session_date,
  target_score,
  court_count,
  player_ids,
  status,
  finalized_at,
  created_at,
  updated_at,
  import_source,
  metadata
)
select
  session_id,
  awarded_at::date,
  15,
  1,
  player_ids,
  'finalized',
  awarded_at,
  awarded_at,
  awarded_at,
  'round-score-reference-v1',
  jsonb_build_object('sessionDate', 'Round ' || round_number, 'referenceRound', round_number)
from session_players;

with player_seed as (
  select name, id
  from players
  where name in ('Siva', 'Thush', 'Nishan', 'Thambi', 'Sam', 'Hursh', 'Abi', 'Jayson')
),
round_seed (round_number, scores) as (
  values
    (1, '{"Siva":7,"Sam":6,"Jayson":5,"Thush":4,"Abi":4,"Thambi":3,"Hursh":2,"Nishan":2}'::jsonb),
    (2, '{"Sam":13,"Siva":12,"Thush":12,"Thambi":10,"Jayson":7,"Nishan":6,"Hursh":5,"Abi":5}'::jsonb),
    (3, '{"Siva":16,"Thush":14,"Thambi":13,"Sam":13,"Jayson":7,"Nishan":7,"Hursh":5,"Abi":5}'::jsonb),
    (4, '{"Siva":21,"Thush":18,"Sam":16,"Thambi":14,"Jayson":7,"Nishan":7,"Hursh":7,"Abi":5}'::jsonb),
    (5, '{"Thush":24,"Siva":22,"Sam":19,"Thambi":17,"Hursh":14,"Nishan":12,"Abi":10,"Jayson":7}'::jsonb),
    (6, '{"Siva":29,"Thush":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (7, '{"Thush":29,"Siva":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (8, '{"Thush":38,"Siva":37,"Sam":23,"Thambi":23,"Nishan":20,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (9, '{"Thush":40,"Siva":37,"Thambi":24,"Nishan":23,"Sam":23,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (10, '{"Thush":44,"Siva":42,"Nishan":26,"Thambi":25,"Sam":23,"Abi":16,"Hursh":15,"Jayson":15}'::jsonb),
    (11, '{"Siva":54,"Thush":50,"Nishan":33,"Thambi":32,"Sam":23,"Hursh":21,"Jayson":20,"Abi":16}'::jsonb),
    (12, '{"Siva":63,"Thush":60,"Nishan":44,"Thambi":34,"Sam":33,"Hursh":27,"Abi":26,"Jayson":20}'::jsonb)
),
score_rows as (
  select
    round_seed.round_number,
    ('20000000-0000-4000-8000-' || lpad(round_seed.round_number::text, 12, '0'))::uuid as session_id,
    score_entry.name,
    score_entry.score::integer as score,
    coalesce((previous_round.scores ->> score_entry.name)::integer, 0) as previous_score,
    ('2026-01-' || lpad(round_seed.round_number::text, 2, '0') || 'T00:00:00.000Z')::timestamptz as awarded_at,
    (
      select count(*) + 1
      from jsonb_each_text(round_seed.scores) as other_score(name, score)
      where other_score.score::integer > score_entry.score::integer
    ) as position
  from round_seed
  join jsonb_each_text(round_seed.scores) as score_entry(name, score) on true
  left join round_seed as previous_round on previous_round.round_number = round_seed.round_number - 1
),
result_rows as (
  select
    score_rows.*,
    player_seed.id as player_id,
    score_rows.score - score_rows.previous_score as points_awarded,
    ('30000000-0000-4000-8000-' || lpad(score_rows.round_number::text, 9, '0') || right(player_seed.id::text, 3))::uuid as history_id
  from score_rows
  join player_seed on player_seed.name = score_rows.name
)
insert into session_results (
  session_id,
  player_id,
  session_points,
  position,
  championship_points_awarded,
  wins,
  draws,
  losses,
  matches_played,
  created_at
)
select
  session_id,
  player_id,
  score,
  position,
  points_awarded,
  0,
  0,
  0,
  0,
  awarded_at
from result_rows;

with player_seed as (
  select name, id
  from players
  where name in ('Siva', 'Thush', 'Nishan', 'Thambi', 'Sam', 'Hursh', 'Abi', 'Jayson')
),
round_seed (round_number, scores) as (
  values
    (1, '{"Siva":7,"Sam":6,"Jayson":5,"Thush":4,"Abi":4,"Thambi":3,"Hursh":2,"Nishan":2}'::jsonb),
    (2, '{"Sam":13,"Siva":12,"Thush":12,"Thambi":10,"Jayson":7,"Nishan":6,"Hursh":5,"Abi":5}'::jsonb),
    (3, '{"Siva":16,"Thush":14,"Thambi":13,"Sam":13,"Jayson":7,"Nishan":7,"Hursh":5,"Abi":5}'::jsonb),
    (4, '{"Siva":21,"Thush":18,"Sam":16,"Thambi":14,"Jayson":7,"Nishan":7,"Hursh":7,"Abi":5}'::jsonb),
    (5, '{"Thush":24,"Siva":22,"Sam":19,"Thambi":17,"Hursh":14,"Nishan":12,"Abi":10,"Jayson":7}'::jsonb),
    (6, '{"Siva":29,"Thush":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (7, '{"Thush":29,"Siva":29,"Sam":23,"Thambi":20,"Abi":16,"Hursh":15,"Nishan":14,"Jayson":7}'::jsonb),
    (8, '{"Thush":38,"Siva":37,"Sam":23,"Thambi":23,"Nishan":20,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (9, '{"Thush":40,"Siva":37,"Thambi":24,"Nishan":23,"Sam":23,"Abi":16,"Hursh":15,"Jayson":12}'::jsonb),
    (10, '{"Thush":44,"Siva":42,"Nishan":26,"Thambi":25,"Sam":23,"Abi":16,"Hursh":15,"Jayson":15}'::jsonb),
    (11, '{"Siva":54,"Thush":50,"Nishan":33,"Thambi":32,"Sam":23,"Hursh":21,"Jayson":20,"Abi":16}'::jsonb),
    (12, '{"Siva":63,"Thush":60,"Nishan":44,"Thambi":34,"Sam":33,"Hursh":27,"Abi":26,"Jayson":20}'::jsonb)
),
history_rows as (
  select
    ('30000000-0000-4000-8000-' || lpad(round_seed.round_number::text, 9, '0') || right(player_seed.id::text, 3))::uuid as id,
    ('20000000-0000-4000-8000-' || lpad(round_seed.round_number::text, 12, '0'))::uuid as session_id,
    player_seed.id as player_id,
    score_entry.score::integer - coalesce((previous_round.scores ->> score_entry.name)::integer, 0) as points,
    ('2026-01-' || lpad(round_seed.round_number::text, 2, '0') || 'T00:00:00.000Z')::timestamptz as awarded_at,
    score_entry.score::integer as cumulative_score,
    round_seed.round_number
  from round_seed
  join jsonb_each_text(round_seed.scores) as score_entry(name, score) on true
  join player_seed on player_seed.name = score_entry.name
  left join round_seed as previous_round on previous_round.round_number = round_seed.round_number - 1
)
insert into championship_history (id, session_id, player_id, points, reason, awarded_at, metadata)
select
  id,
  session_id,
  player_id,
  points,
  'session_award',
  awarded_at,
  jsonb_build_object(
    'source',
    'round-score-reference-v1',
    'sessionDate',
    'Round ' || round_number,
    'referenceRound',
    round_number,
    'cumulativeScore',
    cumulative_score
  )
from history_rows;
