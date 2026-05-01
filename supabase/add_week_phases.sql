-- Add per-week phase override storage to the blocks table.
-- Stores only overridden weeks: {"3": "PEAK", "7": "BUILD"}.
-- Falls back to calculated phase when a week key is absent.
ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS week_phases jsonb NOT NULL DEFAULT '{}';
