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
- [x] Task: Audit `IntervalMetricsCalculator` & Sampling Strategy. [005e812]
    - [x] **CRITICAL:** Verify if power is being resampled or interpolated (e.g., losing 1Hz peaks).
    - [x] Analyze the code for windowing or averaging logic that might include leading/trailing zeros.
    - [x] Check for timestamp alignment issues between Lap events and raw Power samples.
- [x] Task: Implement Hybrid Detection & Precision Logic. [005e812]
    - [x] Modify `IntervalMetricsCalculator` to detect efforts < 15s with high intensity.
    - [x] Adjust the aggregation window to strictly match the Lap timestamps for these segments.
- [x] Task: Update Matching Logic. [005e812]
    - [x] Ensure "Smart Aggregation"/Fusion is bypassed for these specific short, high-power laps.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Core Fix' (Protocol in workflow.md) [005e812]

## Phase 3: Verification & Regression
- [x] Task: Verify fix with captured data. [005e812]
    - [x] Run the reproduction test case and ensure it now passes (Green phase).
- [x] Task: Regression Testing. [005e812]
    - [x] Run existing interval tests (e.g., `tests/test_interval_metrics.py`) to ensure 5min+ efforts are unchanged.
- [x] Task: Output Final Verification Results. [005e812]
    - [x] Create a summary log or small script to display the "Corrected vs expected" values for the user.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Verification' (Protocol in workflow.md) [005e812]
