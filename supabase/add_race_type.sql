-- Add 'Race' to the workout_type enum.
-- IF NOT EXISTS is not supported by ALTER TYPE ADD VALUE in older Postgres,
-- but Supabase (Postgres 15+) supports it.
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'Race';
