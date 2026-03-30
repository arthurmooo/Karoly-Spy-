# Track Specification: Fix Null/Zero Interval Metrics in Database Views

## Overview
Following recent improvements to the Interval Detection "Surgical Mode," the summary metrics (Power, Pace, HR) in the `activities` table (and subsequently the `view_intervals_karo` view) are appearing as NULL or 0. This track aims to fix the data pipeline to ensure summary and detailed interval metrics are correctly calculated, returned, and persisted.

## Functional Requirements
1. **Fix Summary Metric Population**: Ensure that `interval_power_mean/last`, `interval_hr_mean/last`, and `interval_pace_mean/last` are correctly populated in `MetricsCalculator.compute` when using the Surgical Matcher mode.
2. **Handle Running Metrics (Conversion to min/km)**: Ensure that for running activities, Speed (m/s) is converted to Pace (min/km) as a float (e.g., 4.5 for 4:30 min/km) before persistence, so the SQL view remains performant.
3. **Fix Short Interval HR**: Adjust the plateau calculation logic to prevent `avg_hr` from falling to 0 on short intervals where the plateau trim (currently 15s lag) exceeds or significantly reduces the interval duration.
4. **Persist Detailed Intervals during Reprocessing**: Update `ActivityWriter.update_by_id` to ensure that `activity_intervals` (the child table) is updated alongside the main `activities` table during a reprocess run.
5. **Traceability**: Ensure `interval_detection_source` accurately reflects whether the match came from a "lap," "signal," or "plan."

## Non-Functional Requirements
- **Performance**: Maintain vectorized operations where possible to ensure reprocessing remains fast for 100+ athletes.
- **Safety**: DO NOT modify the core lap detection/classification logic or the threshold-based segmentation logic.
- **Constraints**: Due to Nolio API rate limits, all tests and logic must rely on stored FIT files and existing DB records.

## Acceptance Criteria
- [ ] Activities in `view_intervals_karo` show valid Power (W) or Pace (min/km) values for recent interval sessions.
- [ ] `HRmean` and `HRmean W` in the view are non-zero for sessions with heart rate data.
- [ ] Running activities correctly show Pace (min/km) instead of Power in the appropriate columns.
- [ ] Running a `ReprocessingEngine` run updates both the `activities` summary and the `activity_intervals` detail table.

## Out of Scope
- Changing the underlying SQL view definition.
- Modifying the `StepDetector` or `MetaSeeker` core algorithms.
