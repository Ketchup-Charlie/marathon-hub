-- ============================================================
-- Marathon Hub — Supabase Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type workout_type as enum (
  'Easy', 'Long', 'Tempo', 'Interval', 'Strength', 'Rest'
);

create type target_metric_type as enum (
  'Pace', 'HR', 'RPE'
);

create type schedule_status as enum (
  'Pending', 'Scheduled', 'Conflicted', 'Rescheduled'
);

create type compliance_score as enum (
  'Green', 'Yellow', 'Red'
);

create type lap_intent as enum (
  'Warm Up', 'Run', 'Interval', 'Recovery'
);

-- ============================================================
-- SHOES
-- ============================================================

create table shoes (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  brand             text        not null,
  model             text        not null,
  active_status     boolean     not null default true,
  max_lifespan_km   float,
  current_mileage   float       not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table shoes enable row level security;

create policy "shoes: users manage own rows"
  on shoes
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- BLOCKS
-- ============================================================

create table blocks (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  name          text        not null,
  race_date     date        not null,
  total_weeks   int         not null check (total_weeks > 0),
  -- start_date is derived; stored as generated column for queryability
  start_date    date        generated always as (race_date - (total_weeks * 7)) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table blocks enable row level security;

create policy "blocks: users manage own rows"
  on blocks
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- PLANNED WORKOUTS
-- ============================================================

create table planned_workouts (
  id                    uuid              primary key default gen_random_uuid(),
  block_id              uuid              not null references blocks (id) on delete cascade,
  date                  date              not null,
  workout_type          workout_type      not null,
  description           text,
  target_distance_km    float,
  target_metric_type    target_metric_type,
  target_metric_min     text,
  target_metric_max     text,
  gcal_event_id         text,
  schedule_status       schedule_status   not null default 'Pending',
  created_at            timestamptz       not null default now(),
  updated_at            timestamptz       not null default now()
);

alter table planned_workouts enable row level security;

-- Access is granted via the parent block's user_id
create policy "planned_workouts: users manage own rows"
  on planned_workouts
  for all
  using (
    exists (
      select 1 from blocks
      where blocks.id = planned_workouts.block_id
        and blocks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from blocks
      where blocks.id = planned_workouts.block_id
        and blocks.user_id = auth.uid()
    )
  );

-- ============================================================
-- COMPLETED RUNS
-- ============================================================

create table completed_runs (
  id                          uuid             primary key default gen_random_uuid(),
  user_id                     uuid             not null references auth.users (id) on delete cascade,
  date                        date             not null,
  title                       text,
  run_type_tag                text,
  total_distance              float,
  total_time                  interval,
  avg_pace                    text,
  avg_hr                      int,
  max_hr                      int,
  avg_cadence                 int,
  avg_gct                     float,
  avg_vertical_oscillation    float,
  compliance_score            compliance_score,
  shoe_id                     uuid             references shoes (id) on delete set null,
  weather_temp                float,
  weather_humidity            float,
  created_at                  timestamptz      not null default now(),
  updated_at                  timestamptz      not null default now()
);

alter table completed_runs enable row level security;

create policy "completed_runs: users manage own rows"
  on completed_runs
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- RUN LAPS
-- ============================================================

create table run_laps (
  id                          uuid         primary key default gen_random_uuid(),
  run_id                      uuid         not null references completed_runs (id) on delete cascade,
  lap_number                  int          not null,
  lap_intent                  lap_intent,
  distance                    float,
  time                        interval,
  avg_pace                    text,
  avg_hr                      int,
  max_hr                      int,
  avg_cadence                 int,
  avg_gct                     float,
  avg_stride_length           float,
  avg_vertical_oscillation    float,
  created_at                  timestamptz  not null default now(),
  updated_at                  timestamptz  not null default now()
);

alter table run_laps enable row level security;

-- Access is granted via the parent run's user_id
create policy "run_laps: users manage own rows"
  on run_laps
  for all
  using (
    exists (
      select 1 from completed_runs
      where completed_runs.id = run_laps.run_id
        and completed_runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from completed_runs
      where completed_runs.id = run_laps.run_id
        and completed_runs.user_id = auth.uid()
    )
  );

-- ============================================================
-- updated_at trigger (shared)
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shoes_updated_at
  before update on shoes
  for each row execute function set_updated_at();

create trigger blocks_updated_at
  before update on blocks
  for each row execute function set_updated_at();

create trigger planned_workouts_updated_at
  before update on planned_workouts
  for each row execute function set_updated_at();

create trigger completed_runs_updated_at
  before update on completed_runs
  for each row execute function set_updated_at();

create trigger run_laps_updated_at
  before update on run_laps
  for each row execute function set_updated_at();
