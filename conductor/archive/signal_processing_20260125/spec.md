# Track Specification: Signal Processing & Interval Engine Calibration

## Overview
This track focuses on refining the `IntervalMatcher` module to achieve "surgical precision" in aligning theoretical workout plans with real 1Hz data streams (Power/Speed). The primary objective is to enable "Signal Pure" detection (ignoring manual laps) with a precision error (RMSE) of less than 3 seconds per interval bound.

## Core Objective
Calibrate the algorithm to "stick" to the Source of Truth (SoT) sessions despite signal noise, ensuring that the "WORK" intervals are detected with absolute precision.

## Functional Requirements

### 1. Benchmark & Validation Framework
-   **Benchmark Script (`benchmark_matcher.py`):**
    -   Must fetch specific real-world activities corresponding to SoT Session A, B, and C.
    -   **Source Priority:** Local Database -> Nolio API.
    -   **Mandatory Caching:** Downloaded .fit files MUST be cached locally. The script must NEVER re-fetch data from the Nolio API if the file exists on disk.
    -   **Metric:** Calculate RMSE (Root Mean Square Error) between algorithmically detected bounds and the "true" bounds.
-   **SoT Data Acquisition:**
    -   Identify and download the 1Hz streams for the 3 reference sessions (Volume LT1, VMA Short/Long, Mixed Intervals).

### 2. Algorithmic Improvements (Signal Pure Mode)
-   **Architecture:**
    -   Develop improvements in a separate class/module initially.
    -   Once validated, replace the core `IntervalMatcher` logic.
-   **Logic Layer 1: Difference of Means (DoM) & Proxies:**
    -   **DoM:** Replace simple gradients with a sliding window comparison (e.g., `Mean(T-5:T)` vs `Mean(T:T+5)`) to detect regime transitions.
    -   **Cadence Proxy:** Incorporate Cadence (RPM/SPM) analysis as a "leading indicator" of intention. Use the sharp rise in cadence (which often precedes speed/power stability by 1-2s) to "snap" the interval start time more precisely.
-   **Logic Layer 2: Plateau Stability Check:**
    -   Validate intervals based on Coefficient of Variation (CV).
    -   **A/B Test Strategy:** Implement and compare two approaches:
        -   *Approach A:* Fixed Hardcoded Thresholds (e.g., CV < 5% for WORK).
        -   *Approach B:* Adaptive/Statistical Thresholds (based on session-specific rolling variance).
    -   Select the method yielding lower RMSE.

### 3. Escalation Strategy
-   If DoM + Plateau + Cadence Proxy fails to reach < 3s precision, evaluate **Dynamic Time Warping (DTW)**.

## Success Criteria
-   **Precision:** Detected interval bounds must be within **3 seconds** of the true bounds for "WORK" intervals.
-   **Robustness:** The algorithm must successfully distinguish between 1' WORK and 30'' REC in Session B (VMA).
-   **Safety:** Zero unnecessary Nolio API calls during iterative testing.

## Constraints
-   **API Safety:** Strict caching enforced.
-   **Tech Stack:** Python (Pandas/Numpy/Scipy). Vectorized operations only.
