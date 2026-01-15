# Implementation Plan - Track: Auto-Detection of Interval Metrics (Nolio Plan Driven)

## Phase 1: Database & Model Updates
- [x] Task: Create a DB migration to add the 4 new metric columns to the `activity_metrics` table.
    - [x] Renamed existing `last_interval_...` columns to `interval_..._last` in `activities` table via `002_rename_interval_metrics.sql`.
    - [x] Validated schema matches expectations.
- [x] Task: Update the `ActivityMetrics` Pydantic model to include these new optional fields.
    - [x] Created `ActivityMetrics` class in `projectk_core/logic/models.py`.
    - [x] Updated `Activity` to use this model.
    - [x] Updated `MetricsCalculator`, `ActivityWriter`, and scripts to use new keys and model.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Nolio Client & Parsing Logic
- [ ] Task: Extend `NolioClient` to fetch "Planned Workout" details.
    - [ ] Add method `get_planned_workout(activity_id)` which queries the Nolio API.
    - [ ] Handle 404s (no plan exists) gracefully.
- [ ] Task: Implement `NolioPlanParser` class.
    - [ ] Create logic to parse the `structured_workout` JSON from Nolio.
    - [ ] Extract the "Interval" block: Target Type (Distance/Time), Target Value, Reps.
    - [ ] Handle complex structures (e.g., pyramids) by selecting the dominant set (longest total duration).
    - [ ] Write unit tests for various Nolio plan JSON structures (simple, complex, empty).
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Interval Detection Engine
- [x] Task: Implement the `IntervalDetector` class (The Brain).
    - [x] Ported Karoly's logic into `projectk_core/logic/interval_detector.py`.
    - [x] Implemented Peak Detection (Scipy) + Dynamic Thresholding (50% max).
    - [x] Added **Speed-based fallback** for activities without power (e.g., Run EF).
- [x] Task: Implement Metric Calculation logic.
    - [x] Computed `Pmoy`, `HRmean` (Global).
    - [x] Computed `P_last`, `HR_last` (Last Interval).
- [x] Task: Write comprehensive unit tests for `IntervalDetector` using sample `.fit` data.
    - [x] Validated with 4 real-world files (3x1000m, 6x400m, 5x2000m, 2x10min EF).
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Execution
- [ ] Task: Wire it all together in the main processing pipeline (`run_ingest.py` or similar).
    - [ ] After file parsing, call `NolioClient.get_planned_workout`.
    - [ ] If plan exists -> `NolioPlanParser.parse` -> `IntervalDetector.detect`.
    - [ ] If detection successful -> Update `ActivityMetrics` object.
    - [ ] Save to Database.
- [ ] Task: Run end-to-end test with a real `.fit` file and a mocked Nolio API response.
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
