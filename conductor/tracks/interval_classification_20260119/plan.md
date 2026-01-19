# Implementation Plan - Track: Interval Engine & Workout Classification

## Phase 1: Nolio Plan Integration
- [x] Task: Update `NolioClient` to fetch full structured workouts. f2c4709
    - [x] Implement `get_planned_workout_by_id(planned_id)`.
    - [x] Implement `find_planned_workout(athlete_id, date, fuzzy_title)` for fallback search (Same Week window).
- [x] Task: Create `NolioPlanParser` class. 190d1a4
    - [x] Implement logic to traverse the `structured_workout` JSON.
    - [x] **Flattening Logic:** Convert nested repetitions and complex steps (waves) into a linear "Target Grid" (List of expected intervals with Duration, Target Intensity, Type).
    - [x] Filter out `warmup`, `cooldown`, and `rest` steps to focus on the "Work" blocks.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Classification Engine
- [ ] Task: Implement `WorkoutClassifier` class (upgrade from `ActivityClassifier`).
    - [ ] **Strategy A (Plan-Driven):** If `NolioPlanParser` returns a valid target grid > classify as `Intervals`.
    - [ ] **Strategy B (Blind Fallback):** Implement signal analysis.
        - [ ] Calculate "Volatility Score" (StdDev of Power/Speed).
        - [ ] Calculate "Zone Distribution" (% time in Z4+).
        - [ ] Regex check on Activity Title.
- [ ] Task: Unit Tests for Classification.
    - [ ] Test with a Nolio JSON sample (Simple Reps).
    - [ ] Test with a Nolio JSON sample (Complex Waves).
    - [ ] Test with no plan (Signal-based).
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Surgical Detection (The Matcher)
- [ ] Task: Implement `IntervalMatcher` class.
    - [ ] Input: `.fit` dataframe + Target Grid from Phase 1.
    - [ ] **Algorithm:** Implement "Strict Window Sliding".
        - [ ] For each target interval (e.g., 120s), scan the dataframe to find the 120s window with max average intensity (Power or Speed).
        - [ ] Ensure detected windows do not overlap significantly.
    - [ ] **Reality Check:** Count valid detections vs Plan.
- [ ] Task: Metric Extraction Logic.
    - [ ] Compute Avg Power/Pace & Avg HR for each detected window.
    - [ ] Compute "Respect Score" (Realized / Target).
    - [ ] Compute Global Interval Metrics (Mean of all intervals, Last interval).
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Storage
- [ ] Task: Update `ActivityMetrics` model.
    - [ ] Add fields for `interval_respect_score`, `interval_pace_mean`, `interval_pace_last`.
- [ ] Task: Update `run_ingest.py` pipeline.
    - [ ] Step 1: Fetch Plan (with fallback).
    - [ ] Step 2: Classify (Plan vs Blind).
    - [ ] Step 3: If Intervals -> Run Matcher -> Store Metrics.
- [ ] Task: End-to-End Test.
    - [ ] Run on Adrien's "10x2'" session (with mock or real API access).
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
