-- =============================================================
-- Marathon Hub — Seed: Sydney Marathon 2026 Training Block
-- =============================================================
-- Before running, replace the placeholder user ID on the
-- INSERT INTO blocks line:
--   '00000000-0000-0000-0000-000000000000'  →  your auth.users UUID
--
-- NOTE: start_date is a generated column (race_date - total_weeks * 7).
-- With race_date = 2026-08-30 and total_weeks = 12 it resolves to
-- 2026-06-07. Week 1 workouts begin Mon 2026-06-08; race day is
-- Sun 2026-08-30 (end of week 12).
--
-- target_metric_min / target_metric_max are TEXT:
--   Pace targets stored as 'M:SS'   e.g. '5:40'
--   HR targets stored as integer    e.g. '136'
-- =============================================================

BEGIN;

-- ── Block ──────────────────────────────────────────────────────────────────
INSERT INTO blocks (id, user_id, name, race_date, total_weeks)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'd831c2c7-e96d-4fba-a53d-4468ea2bc250',  -- REPLACE WITH YOUR USER ID
  'Sydney Marathon 2026',
  '2026-08-30',
  12
);

-- ── Planned Workouts ───────────────────────────────────────────────────────
-- Columns: block_id, date, workout_type, description,
--          target_distance_km, target_metric_type, target_metric_min, target_metric_max

-- Week 1 (Base) ─ Jun 8–14
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-08', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-09', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-10', 'Tempo',    'Tempo run @ 5:45/km',        10.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-11', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-13', 'Long',     'Long run',                   20.0,  'HR',   '136', '145');

-- Week 2 (Base) ─ Jun 15–21
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-15', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-16', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-17', 'Tempo',    'Tempo run @ 5:45/km',        10.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-18', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-20', 'Long',     'Long run',                   22.0,  'HR',   '136', '145');

-- Week 3 (Base) ─ Jun 22–28
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-22', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-23', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-24', 'Tempo',    'Tempo run @ 5:45/km',        10.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-25', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-27', 'Long',     'Long run',                   24.0,  'HR',   '136', '145');

-- Week 4 (Base) ─ Jun 29 – Jul 5
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-29', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-06-30', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-01', 'Tempo',    'Tempo run @ 5:45/km',        10.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-02', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-04', 'Long',     'Long run',                   26.0,  'HR',   '136', '145');

-- Week 5 (Build) ─ Jul 6–12
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-06', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-07', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-08', 'Interval', '6×1km @ 5:20/km, 400m recovery', 10.0, 'Pace', '5:15', '5:25'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-09', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-11', 'Long',     'Long run',                   28.0,  'HR',   '136', '145');

-- Week 6 (Build) ─ Jul 13–19
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-13', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-14', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-15', 'Interval', '6×1km @ 5:20/km, 400m recovery', 10.0, 'Pace', '5:15', '5:25'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-16', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-18', 'Long',     'Long run',                   30.0,  'HR',   '136', '145');

-- Week 7 (Build) ─ Jul 20–26
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-20', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-21', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-22', 'Interval', '6×1km @ 5:20/km, 400m recovery', 10.0, 'Pace', '5:15', '5:25'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-23', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-25', 'Long',     'Long run',                   32.0,  'HR',   '136', '145');

-- Week 8 (Build) ─ Jul 27 – Aug 2
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-27', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-28', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-29', 'Interval', '6×1km @ 5:20/km, 400m recovery', 10.0, 'Pace', '5:15', '5:25'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-07-30', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-01', 'Long',     'Long run',                   34.0,  'HR',   '136', '145');

-- Week 9 (Peak) ─ Aug 3–9
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-03', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-04', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-05', 'Tempo',    'Tempo run @ 5:45/km',        14.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-06', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-08', 'Long',     'Long run',                   36.0,  'HR',   '136', '145');

-- Week 10 (Peak) ─ Aug 10–16
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-10', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-11', 'Easy',     'Easy aerobic run',           12.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-12', 'Tempo',    'Tempo run @ 5:45/km',        14.0,  'Pace', '5:40', '5:50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-13', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-15', 'Long',     'Long run',                   38.0,  'HR',   '136', '145');

-- Week 11 (Taper 1) ─ Aug 17–23
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-17', 'Easy',     'Easy aerobic run',            8.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-18', 'Easy',     'Easy aerobic run',           10.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-19', 'Interval', '6×1km @ 5:20/km, 400m recovery', 8.0, 'Pace', '5:15', '5:25'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-20', 'Easy',     'Easy aerobic run',            6.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-22', 'Long',     'Long run',                   28.0,  'HR',   '136', '145');

-- Week 12 (Taper 2 + Race) ─ Aug 24–30
INSERT INTO planned_workouts (block_id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-24', 'Easy',     'Easy aerobic run',            6.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-25', 'Easy',     'Easy aerobic run',            5.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-26', 'Easy',     'Easy aerobic run',            4.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-29', 'Easy',     'Shakeout run',                3.0,  'HR',   '136', '140'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-08-30', 'Long',     'Sydney Marathon — Race Day',  42.2, 'Pace', '6:00', '6:10');

COMMIT;
