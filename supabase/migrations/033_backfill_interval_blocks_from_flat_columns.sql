-- Migration: 033_backfill_interval_blocks_from_flat_columns.sql
-- Description: Backfill segmented_metrics.interval_blocks from legacy flat columns
--              for historical activities that predate the block system.
-- Date: 2026-02-13
--
-- Context: The monitoring view now reads interval metrics from
--   segmented_metrics->'interval_blocks'->0  (block-based layout).
-- Historical activities only have data in the flat columns:
--   interval_power_mean, interval_power_last, interval_hr_mean,
--   interval_hr_last, interval_pace_mean, interval_pace_last.
-- This migration copies those values into interval_blocks[0] so
-- they appear in the Retool dashboard.

UPDATE activities
SET segmented_metrics = jsonb_set(
    COALESCE(segmented_metrics, '{}'::jsonb),
    '{interval_blocks}',
    jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object(
            'interval_power_mean', interval_power_mean,
            'interval_power_last', interval_power_last,
            'interval_hr_mean',    interval_hr_mean,
            'interval_hr_last',    interval_hr_last,
            'interval_pace_mean',  interval_pace_mean,
            'interval_pace_last',  interval_pace_last
        ))
    )
)
WHERE
    -- Has at least one flat interval metric
    (interval_power_mean IS NOT NULL
     OR interval_hr_mean IS NOT NULL
     OR interval_pace_mean IS NOT NULL)
    -- But no interval_blocks yet (NULL, absent, or empty array)
    AND (
        segmented_metrics IS NULL
        OR segmented_metrics->'interval_blocks' IS NULL
        OR segmented_metrics->'interval_blocks' = '[]'::jsonb
        OR segmented_metrics->'interval_blocks' = 'null'::jsonb
    );
