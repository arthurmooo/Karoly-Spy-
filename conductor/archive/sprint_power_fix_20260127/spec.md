# Specification: Fix Power Calculation for Short Intervals

## Overview
The system currently underestimates average power for short, high-intensity neuromuscular intervals (e.g., reporting ~278W for 10s sprints that should be 500-800W). This track aims to diagnose and fix this calculation error specifically for short duration efforts (< 15s) while preserving the integrity of longer intervals.

## Context
- **Case Study:** Séraphin Barbot, Home Trainer session (27/01/2026).
- **Issue:** Micro-sprints (approx. 10s) defined by explicit Laps are being averaged incorrectly, likely due to synchronization offsets, aggressive aggregation with rest periods, or improper windowing in `IntervalMetricsCalculator`.

## Functional Requirements

### 1. Hybrid Detection Strategy
- The refined calculation logic MUST be applied **only** when:
    - Interval Duration is < 15 seconds.
    - AND Average Power exceeds a significant intensity threshold (e.g., > Threshold).

### 2. Strict Lap Adherence
- When processing these short intervals, the system MUST strictly honor the explicit Lap boundaries provided in the source file (FIT/Nolio).
- "Smart Aggregation" or "Drift-Resistant Matching" logic MUST NOT merge these high-intensity short laps with adjacent rest periods.

### 3. Precision Metrics Calculation
- The `IntervalMetricsCalculator` must be audited and adjusted to ensure it captures the true "working phase" of a short sprint.
- Eliminate "ramp-up" or "ramp-down" zero-averaging if it significantly skews the result of a <15s effort.

## Non-Functional Requirements
- **No Regression:** The fix must not alter the calculated metrics for standard long intervals (e.g., 5min, 20min efforts).
- **Performance:** The calculation adjustment should not noticeably impact processing time.

## Verification & Acceptance Criteria
- **Unit Tests:** A new test suite using Séraphin Barbot's session data (captured via `fetch_session.py`) must be created.
- **Accuracy:** The calculated average power for the target sprints must match the manual analysis (within acceptable tolerance, e.g., +/- 5%).
- **User Verification:** The system must output clear results (logs or report) allowing the user to visually confirm the corrected values against their expectation.
