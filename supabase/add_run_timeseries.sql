CREATE TABLE run_timeseries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES completed_runs(id) ON DELETE CASCADE,
  seconds_elapsed integer NOT NULL,
  distance_km float,
  pace_sec_per_km integer,
  hr integer,
  cadence integer,
  elevation_m float,
  lat float,
  lon float,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_run_timeseries_run_id ON run_timeseries(run_id);

ALTER TABLE run_timeseries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own timeseries"
  ON run_timeseries FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM completed_runs WHERE user_id = auth.uid()
    )
  );
