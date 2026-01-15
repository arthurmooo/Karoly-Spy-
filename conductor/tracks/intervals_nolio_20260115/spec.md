# Track: Auto-Detection of Interval Metrics (Nolio Plan Driven)

## 1. Overview
This feature automates the calculation of four specific physiological metrics for structured workout sessions. Instead of relying on manual "lap" buttons (which athletes often forget), the system will algorithmically detect intervals by using the **Structured Workout** data from the Nolio API as a blueprint. It will scan the actual activity data to find the "best effort" segments that match the plan's structure.

## 2. Core Metrics
We will add four new columns to the database for each analyzed activity (likely in `activity_metrics` or similar):
1.  **Puissance (Last):** Average Power of the *last* detected interval.
2.  **HRmean (Last):** Average Heart Rate of the *last* detected interval.
3.  **Pmoy (Global):** Average Power across *all* detected intervals.
4.  **HRmean W (Global):** Average Heart Rate across *all* detected intervals.

## 3. Functional Requirements

### 3.1 Nolio Plan Ingestion
*   The system must query the Nolio API to retrieve the **Planned Workout** associated with the ingested `.fit` file.
*   **Parsing Logic:** We must parse the `structured_workout` JSON object from Nolio to determine:
    *   **Target Interval Type:** `duration` (seconds) or `distance` (meters).
    *   **Target Value:** e.g., "30 seconds" or "400 meters".
    *   **Planned Repetitions:** e.g., "10 reps" (used as a baseline).
    *   **Extraction Rule:** If multiple sets exist (e.g., 2 sets of 8x400m), we will target the *core* interval set (the one with the highest intensity or repetition count).

### 3.2 Intelligent Interval Detection (The "Brain")
*   **Strategy:** "Plan-Seeded Best Effort".
*   **Input:** The system takes the *Target Type* and *Target Value* from the Nolio plan.
*   **Algorithm (Based on Karoly's Notebook):**
    1.  Scan the high-frequency `.fit` data (Power/Speed series).
    2.  Identify **clusters of high intensity** that match the *Target Value* (with a configurable tolerance, e.g., ±10% duration/distance).
    3.  **Adaptation:** The algorithm will detect *all* valid efforts. If the plan called for 8 reps but the athlete performed 9, the system will detect and analyze all 9.
    4.  **Separation:** Intervals must be separated by identifiable recovery periods to avoid merging.

### 3.3 Metric Calculation
*   Once the list of valid intervals is identified:
    *   Calculate `Avg Power` and `Avg HR` for each individual interval.
    *   Compute the **Global Averages** (Pmoy, HRmean W) from the full set.
    *   Identify the **Last Interval** (chronologically) to extract its specific `Puissance` and `HRmean`.

### 3.4 Database Schema
*   Update the `activities` (or `activity_metrics`) table to include the 4 new columns.
*   Ensure these fields are nullable (as not all sessions are interval sessions).

## 4. Edge Cases & Constraints
*   **No Structured Plan:** If the Nolio plan is text-only (no `structured_workout` JSON) or missing, the interval detection will be skipped, and these 4 fields will remain `null`.
*   **Mixed Intervals:** For complex pyramids, the system will focus on the most prominent interval set defined in the plan.
*   **Data Quality:** Intervals with significant data dropouts (>20%) should be excluded.
