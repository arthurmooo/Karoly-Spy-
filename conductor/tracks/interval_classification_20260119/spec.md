# Specification: Interval Engine & Workout Classification

## 1. Overview
The goal is to implement a robust engine to classify workouts (Endurance vs Intervals) and surgically extract interval metrics. This engine will leverage Nolio's "Planned Workout" JSON (available via API) as the primary source of truth, while providing a strong fallback mechanism using signal analysis and text pattern recognition.

## 2. Functional Requirements

### 2.1 Workout Classification
The system must determine the `work_type` of an activity using the following priority:
1.  **Primary Strategy (Planned Structure):**
    *   Retrieve the planned workout via `planned_id` from the Nolio API.
    *   If `planned_id` is missing, search for a matching planned workout within the **Same Week (Monday-Sunday)** based on title similarity.
    *   **Structure Parsing:** Parse the JSON to identify "Work" blocks.
        *   Handle standard `type: repetition` blocks (e.g., 5x30/30).
        *   **Handle Complex Steps:** Detect "waves" or steps (e.g., 2km @ 14km/h + 1km @ 16km/h) by filtering steps with `intensity_type` = "active" or "ramp_up". Flatten nested structures into a linear list of "Target Intervals".
    *   If significant work blocks are found -> Classify as `Intervals`.
2.  **Fallback Strategy (Blind Detection):**
    *   Used if no plan is linked or found.
    *   Analyze the `.fit` file signal for **High Variability** (Standard Deviation) in Power/Speed.
    *   Scan the activity title for keywords: "x" (e.g., 10x30), "VMA", "Seuil", "Bloc", "Fractionné".
    *   Detect significant time spent in high-intensity zones (e.g., >10% in Z4+).

### 2.2 Surgical Interval Detection (The "Interval Matcher")
For sessions classified as `Intervals`, the system must identify the start/end times of each effort.
*   **Target Grid:** Construct a target list from the Nolio plan (e.g., 10 reps of 120s @ 300W).
*   **Matching Algorithm:**
    *   **Strict Windowing:** Use the exact planned duration (e.g., 120s).
    *   **Sliding Fit:** Slide this window across the data to find the segment with the highest average intensity (Power for Bike, Speed for Run) that aligns with the detected "work" blocks.
    *   **Reality-Centric:** Detect the *actual* number of intervals performed. If the plan says 10 but 8 are found, report 8. Flag the session as "Incomplete" if detection < plan.

### 2.3 Metrics Extraction
For each detected interval, calculate and store:
*   **Bike:** Average Power (Watts), Average Heart Rate (bpm).
*   **Run:** Average Pace (min/km or speed m/s), Average Heart Rate (bpm).
*   **Respect Score:** A percentage indicating adherence to the target intensity (e.g., Realized / Target * 100).
*   **Global Metrics:**
    *   `interval_power_mean` / `interval_pace_mean` (Average of all work intervals).
    *   `interval_power_last` / `interval_pace_last` (Average of the final interval).
    *   `interval_hr_mean` & `interval_hr_last`.

## 3. Non-Functional Requirements
*   **Performance:** Interval detection should not significantly slow down the ingestion pipeline (max +2s per file).
*   **Resilience:** Must handle "Date Mismatches" by looking up to ±7 days (Same Week) if `planned_id` is broken.

## 4. Out of Scope
*   Dynamic Time Warping (Elastic Matching) for Phase 1 (Strict windowing only).
*   Recovery analysis (HR drop) for this specific track.

## 5. Acceptance Criteria
*   [ ] A session titled "10x2' Z3" is correctly classified as `Intervals`.
*   [ ] If a plan exists, the system extracts the exact number of performed intervals (e.g., 8 detected vs 10 planned).
*   [ ] Metrics (Avg Power/Pace, Avg HR, Respect Score) are calculated for each interval and stored in `activities`.
*   [ ] Fallback classification works for an interval session without a Nolio plan.
