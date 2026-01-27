# Track Specification: Fix Classification Over-Sensitivity (Auto-Laps)

## Overview
- **Track ID:** `fix_classification_20260127`
- **Type:** Bug Fix / Logic Refinement
- **Objective:** Prevent the misclassification of "Endurance" sessions as "Intervalles" due to device-generated Auto-Laps (1km/5km for road, 50-400m for swimming).
- **Target Sessions:** 
    1. Matthieu Poullain (2026-01-27, Natation)
    2. Ludovic Marchand (2026-01-27, Vélo - Route)
    3. Ludovic Marchand (2026-01-27, Vélo - Home Trainer)

## Functional Requirements

### 1. Strict Plan Priority (Strategy A)
- If a Nolio Planned Session exists for the activity's date and its type is "Endurance", the engine **MUST** classify the activity as "Endurance", regardless of the number of laps detected.
- This rule applies to all sports (Swimming, Cycling, Running, etc.).

### 2. Intelligent Lap Filtering (Fallback for Unplanned)
- When no plan is available, the engine must distinguish between "Technical Laps" (Auto-Laps) and "Workout Intervals".
- **Rule:** Ignore "Technical Laps" based on sport (±1% tolerance):
    - **Running/Cycling:** 1000m, 5000m.
    - **Swimming:** 50m, 100m, 200m, 400m.
- **Variance Check:** If the remaining laps (or all laps if regular) show a variance in duration/intensity below a threshold `x%` (to be determined during analysis), classify as "Endurance".

### 3. Non-Regression
- True interval sessions (e.g., Séraphin's workouts) must remain correctly classified as "Intervalles".
- The logic must be surgical and only affect sessions that exhibit "Auto-Lap" patterns or have explicit "Endurance" plans.

## Technical Constraints
- Use `fetch_session.py` to retrieve raw data for analysis while respecting Nolio API quotas.
- Modifications should be made in `projectk_core/logic/` (likely `classification.py` or `interval_engine.py`).
- Update the 3 specific sessions in the Supabase production database once the logic is verified locally.

## Acceptance Criteria
- [ ] The 3 targeted sessions are reclassified as "Endurance" in the local test environment.
- [ ] Séraphin's reference interval session is NOT reclassified (remains "Intervalles").
- [ ] Swimming-specific auto-lap distances (50m, 100m, etc.) are correctly handled.
- [ ] The `x%` variance threshold is derived from data analysis and documented in the code.
- [ ] Database update is performed for the 3 production entries.
