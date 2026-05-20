ALTER TABLE planned_workouts ADD COLUMN IF NOT EXISTS secondary_type text;
ALTER TABLE planned_workouts ADD COLUMN IF NOT EXISTS secondary_description text;
