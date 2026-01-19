# Implementation Plan - Track: Interval Engine & Workout Classification [checkpoint: 92f8fda]

## Phase 1: Nolio Plan Integration
- [x] Task: Update `NolioClient` to fetch full structured workouts. f2c4709
    - [x] Implement `get_planned_workout_by_id(planned_id)`.
    - [x] Implement `find_planned_workout(athlete_id, date, fuzzy_title)` for fallback search (Same Week window).
- [x] Task: Create `NolioPlanParser` class. 190d1a4
    - [x] Implement logic to traverse the `structured_workout` JSON.
    - [x] **Flattening Logic:** Convert nested repetitions and complex steps (waves) into a linear "Target Grid" (List of expected intervals with Duration, Target Intensity, Type).
    - [x] Filter out `warmup`, `cooldown`, and `rest` steps to focus on the "Work" blocks.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Classification Engine [checkpoint: d0eb20d]
- [x] Task: Implement `WorkoutClassifier` class (upgrade from `ActivityClassifier`). b18c2d3
    - [x] **Strategy A (Plan-Driven):** If `NolioPlanParser` returns a valid target grid > classify as `Intervals`.
    - [x] **Strategy B (Blind Fallback):** Implement signal analysis.
        - [x] Calculate "Volatility Score" (StdDev of Power/Speed).
        - [x] Calculate "Zone Distribution" (% time in Z4+).
        - [x] Regex check on Activity Title.
- [x] Task: Unit Tests for Classification. b18c2d3
    - [x] Test with a Nolio JSON sample (Simple Reps).
    - [x] Test with a Nolio JSON sample (Complex Waves).
    - [x] Test with no plan (Signal-based).
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Surgical Detection (The Matcher) [checkpoint: c7f9b20]
- [x] Task: Implement `IntervalMatcher` class. d080aa1
    - [x] Input: `.fit` dataframe + Target Grid from Phase 1.
    - [x] **Algorithm:** Implement "Strict Window Sliding".
        - [x] For each target interval (e.g., 120s), scan the dataframe to find the 120s window with max average intensity (Power or Speed).
        - [x] Ensure detected windows do not overlap significantly.
    - [x] **Reality Check:** Count valid detections vs Plan.
- [x] Task: Metric Extraction Logic. 86a3c3c
    - [x] Compute Avg Power/Pace & Avg HR for each detected window.
    - [x] Compute "Respect Score" (Realized / Target).
    - [x] Compute Global Interval Metrics (Mean of all intervals, Last interval).
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Storage
- [x] Task: Update `ActivityMetrics` model. 055d236
    - [x] Add fields for `interval_respect_score`, `interval_pace_mean`, `interval_pace_last`.
- [ ] Task: Update `run_ingest.py` pipeline.
    - [ ] Step 1: Fetch Plan (with fallback).
    - [ ] Step 2: Classify (Plan vs Blind).
    - [ ] Step 3: If Intervals -> Run Matcher -> Store Metrics.
- [ ] Task: End-to-End Test.
    - [ ] Run on Adrien's "10x2'" session (with mock or real API access).
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
