# Implementation Plan - Signal Processing & Interval Engine Calibration

## Phase 1: Benchmark Infrastructure Setup

- [ ] Task: Create Local Cache Directory Structure
    - [ ] Create `data/test_cache/` directory (if not exists) and add to `.gitignore`.
- [ ] Task: Implement `benchmark_matcher.py` (Scaffolding)
    - [ ] Implement logic to check local cache before calling Nolio API.
    - [ ] Implement "Source of Truth" configuration dictionary (Activity IDs, True Laps structure).
    - [ ] Implement Nolio API fetcher (with rate limiting) to populate cache if missing.
- [ ] Task: Acquire SoT Data
    - [ ] Run `benchmark_matcher.py` to fetch and cache the 3 reference sessions (Session A, B, C).
    - [ ] Manually verify the downloaded .fit files are valid using `fitdecode`.
- [ ] Task: Implement RMSE Calculation Logic
    - [ ] Add method to compare `IntervalMatcher` output vs. True Laps.
    - [ ] Output a baseline RMSE report for the *current* algorithm on these 3 sessions.
- [ ] Task: Conductor - User Manual Verification 'Benchmark Infrastructure Setup' (Protocol in workflow.md)

## Phase 2: Algorithm Prototyping (Parallel Track)

- [ ] Task: Create `PureSignalMatcher` Class
    - [ ] Create `projectk_core/processing/pure_signal_matcher.py`.
- [ ] Task: Implement Difference of Means (DoM) Logic
    - [ ] Implement vectorized sliding window means (Mean(T-5:T) vs Mean(T:T+5)).
    - [ ] Replace simple `np.diff` gradient logic with DoM transition detection.
- [ ] Task: Implement Cadence "Snap" Logic (Defensive)
    - [ ] **Defensive Logic:** Use Cadence as a leading indicator ONLY if signal is present.
    - [ ] Fallback gracefully to Power/Speed DoM if Cadence is missing or corrupted.
    - [ ] Implement 1-2s lookback "snap" to Cadence rise.
- [ ] Task: Implement Plateau Stability Check (A/B Testing)
    - [ ] Approach A: Fixed Thresholds.
    - [ ] Approach B: Adaptive/Statistical (Rolling Variance).
    - [ ] Run benchmark and select the winner based on lowest RMSE.
- [ ] Task: Conductor - User Manual Verification 'Algorithm Prototyping' (Protocol in workflow.md)

## Phase 3: Integration & Optimization

- [ ] Task: Final Validation & Session B "Crash Test"
    - [ ] Tune window sizes and thresholds to minimize RMSE.
    - [ ] **Judge of Peace:** Explicitly verify detection of ALL 15 blocks (10+5) in Session B without merging due to short (30s) recoveries.
- [ ] Task: Sanity Check (Negative Testing)
    - [ ] Test algorithm on "dirty" data (e.g., stops for shoelaces, walking periods).
    - [ ] Ensure NO "hallucinated" intervals are detected during rest or corrupted segments.
- [ ] Task: Integration into Core
    - [ ] Refactor `projectk_core/processing/interval_matcher.py` to replace old logic with new validated logic.
    - [ ] Run full regression test suite.
- [ ] Task: Cleanup
    - [ ] Remove temporary prototyping files and document final parameters.
- [ ] Task: Conductor - User Manual Verification 'Integration & Optimization' (Protocol in workflow.md)
