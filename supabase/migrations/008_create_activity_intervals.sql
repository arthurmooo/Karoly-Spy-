-- Migration: Create activity_intervals table
-- Description: Stores detailed metrics for each detected interval in an activity.
-- Date: 2026-01-24

CREATE TABLE IF NOT EXISTS activity_intervals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    duration FLOAT NOT NULL,
    type TEXT NOT NULL,
    detection_source TEXT NOT NULL,
    avg_speed FLOAT,
    avg_power FLOAT,
    avg_hr FLOAT,
    avg_cadence FLOAT,
    pa_hr_ratio FLOAT,
    decoupling FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_intervals_activity_id ON activity_intervals(activity_id);

ALTER TABLE activity_intervals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON activity_intervals;
CREATE POLICY "Service role full access" ON activity_intervals FOR ALL TO service_role USING (true);
