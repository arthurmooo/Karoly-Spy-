-- Migration 028: Nullify interval metrics for endurance and competition activities
-- To avoid displaying confusing averages on non-interval sessions.

UPDATE activities
SET 
    interval_hr_last = NULL,
    interval_hr_mean = NULL,
    interval_pace_last = NULL,
    interval_pace_mean = NULL,
    interval_power_last = NULL,
    interval_power_mean = NULL,
    manual_interval_hr_last = NULL,
    manual_interval_hr_mean = NULL,
    manual_interval_pace_last = NULL,
    manual_interval_pace_mean = NULL,
    manual_interval_power_last = NULL,
    manual_interval_power_mean = NULL,
    interval_respect_score = NULL,
    interval_detection_source = NULL
WHERE work_type IN ('endurance', 'competition');
