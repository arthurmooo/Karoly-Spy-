# Implementation Plan - Interval Engine Refactoring (Track 1.5)

## Phase 1: Preparation & Infrastructure [checkpoint: b041c0d]
- [x] Task: Create `projectk_core/logic/interval_engine.py` and `tests/test_interval_engine.py` structure. [0faf1f4]
    - [ ] Create initial empty class `IntervalEngine`.
    - [ ] Create test scaffold with `pytest`.
- [x] Task: Implement Data Models for Intervals. [906979c]
    - [ ] Define `IntervalBlock` (metrics, start_time, end_time, type).
    - [ ] Define `DetectionSource` enum (PLAN, LAP, ALGO).
- [ ] Task: Conductor - User Manual Verification 'Preparation & Infrastructure' (Protocol in workflow.md)

## Phase 2: Detection Strategy - Priority 1 (Plan Correlation)
- [x] Task: Implement Plan Projection Logic. [9ee309f]
    - [ ] Create `PlanProjector` class to map Nolio structure onto time series.
    - [ ] TDD: Test mapping of simple 10x400m structure.
- [x] Task: Implement "Elastic Matcher" for structural alignment. [9e35caa]
    - [ ] Logic to align projected plan with actual duration/distance.
    - [ ] TDD: Test matching when athlete is slightly faster/slower than plan.
- [x] Task: Handle Missing Repetitions. [cbd9f59]
    - [ ] Logic to detect if a block is cut short (e.g., 8/10 reps).
    - [ ] TDD: Test case where athlete stops early.
- [ ] Task: Conductor - User Manual Verification 'Detection Strategy - Priority 1' (Protocol in workflow.md)

## Phase 3: Detection Strategy - Priority 2 & 3 (Laps & Algo)
- [ ] Task: Implement Lap Analyzer (Priority 2).
    - [ ] Logic to import laps from FIT file.
    - [ ] Filter logic: Remove "parasite laps" (<10s or inconsistent).
    - [ ] TDD: Test with a real FIT file containing manual laps.
- [ ] Task: Implement Algorithmic Detector (Priority 3 - Fallback).
    - [ ] Logic to detect "Signal Rupture" (Power/Speed changes).
    - [ ] TDD: Test on a file without laps or plan (raw signal).
- [ ] Task: Implement "Ensemble Voter" (Fusion).
    - [ ] Logic to cross-reference Plan, Laps, and Algo.
    - [ ] Scoring system to select the best start/end times.
    - [ ] TDD: Test with conflicting inputs (e.g., Lap pressed late).
- [ ] Task: Conductor - User Manual Verification 'Detection Strategy - Priority 2 & 3' (Protocol in workflow.md)

## Phase 4: Metrics Calculation & Precision
- [ ] Task: Implement Interval Metrics Calculator.
    - [ ] Calculate Avg Speed, Power, HR, Cadence per interval.
    - [ ] **Crucial:** Implement "Total Integration" for HR (no filters).
- [ ] Task: Implement Efficiency & Drift Metrics.
    - [ ] Calculate Pa:Hr / Vitesse:Hr ratios.
    - [ ] Calculate Drift (Last Rep vs Mean Reps).
    - [ ] TDD: Verify math against Karoly's manual formulas.
- [ ] Task: Conductor - User Manual Verification 'Metrics Calculation & Precision' (Protocol in workflow.md)

## Phase 5: Persistence & Output
- [ ] Task: Create SQL Schema for `activity_intervals`.
    - [ ] Migration file for new table.
- [ ] Task: Implement Storage Logic.
    - [ ] Save detected intervals to Supabase.
- [ ] Task: Generate Audit Log & JSON Export.
    - [ ] Create `IntervalAudit` class to log decision logic.
    - [ ] Format JSON output for frontend.
- [ ] Task: Conductor - User Manual Verification 'Persistence & Output' (Protocol in workflow.md)