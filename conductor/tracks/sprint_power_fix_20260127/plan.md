# Implementation Plan: Fix Power Calculation for Short Intervals

## Phase 1: Diagnosis & Data Capture
- [x] Task: Capture test data for Séraphin Barbot (2026-01-27). [182f25f]
    - [x] Identify Nolio Activity ID for the session.
    - [x] Run `scripts/fetch_session.py` to store JSON metadata and .FIT file.
- [x] Task: Create a reproduction test case. [182f25f]
    - [x] Create `tests/test_short_interval_power.py`.
    - [x] Load the captured session and isolate the miscalculated laps (e.g., Laps 11, 13, 15).
    - [x] Assert that the current calculation fails to meet the expected power threshold (>500W).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Diagnosis' (Protocol in workflow.md) [182f25f]

## Phase 2: Audit & Core Fix
- [ ] Task: Audit `IntervalMetricsCalculator` & Sampling Strategy.
    - [ ] **CRITICAL:** Verify if power is being resampled or interpolated (e.g., losing 1Hz peaks).
    - [ ] Analyze the code for windowing or averaging logic that might include leading/trailing zeros.
    - [ ] Check for timestamp alignment issues between Lap events and raw Power samples.
- [ ] Task: Implement Hybrid Detection & Precision Logic.
    - [ ] Modify `IntervalMetricsCalculator` to detect efforts < 15s with high intensity.
    - [ ] Adjust the aggregation window to strictly match the Lap timestamps for these segments.
- [ ] Task: Update Matching Logic.
    - [ ] Ensure "Smart Aggregation"/Fusion is bypassed for these specific short, high-power laps.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Fix' (Protocol in workflow.md)

## Phase 3: Verification & Regression
- [ ] Task: Verify fix with captured data.
    - [ ] Run the reproduction test case and ensure it now passes (Green phase).
- [ ] Task: Regression Testing.
    - [ ] Run existing interval tests (e.g., `tests/test_interval_metrics.py`) to ensure 5min+ efforts are unchanged.
- [ ] Task: Output Final Verification Results.
    - [ ] Create a summary log or small script to display the "Corrected vs expected" values for the user.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Verification' (Protocol in workflow.md)
