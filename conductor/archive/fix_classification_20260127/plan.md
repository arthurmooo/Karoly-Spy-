# Implementation Plan - Track: fix_classification_20260127

Prevent "Endurance" sessions with Auto-Laps (1km/5km road, 50-400m swim) from being misclassified as "Intervalles" by enforcing "Strict Plan Priority" and intelligent lap filtering.

## Phase 1: Diagnosis & Baseline Analysis
- [x] Task: Data Acquisition. Use `scripts/fetch_session.py` (simulated via DB queries) to download raw data for the 3 target sessions and Séraphin's reference session.
- [x] Task: Lap Pattern Analysis. Analyze the laps of the 3 target sessions to confirm the presence of Auto-Laps and calculate the variance in duration/intensity.
- [x] Task: Threshold Calibration. Determine the optimal variance threshold `x%` that distinguishes these endurance sessions from true intervals. (Low variance < 2% detected on regular blocks).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Diagnosis & Baseline Analysis' (Protocol in workflow.md)

## Phase 2: Implementation of Strategy A (Strict Plan Priority)
- [x] Task: Create tests for Plan-Driven Classification. Write unit tests in `tests/test_classification.py` that simulate an "Endurance" plan for an activity with many laps.
- [x] Task: Implement Strict Plan Priority. Modify the classification logic (likely in `projectk_core/logic/classification.py`) to check the Nolio Planned Session type first.
- [x] Task: Verify Plan-Driven Tests. Run tests and ensure Strategy A is correctly applied.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Implementation of Strategy A' (Protocol in workflow.md)

## Phase 3: Implementation of Strategy B (Intelligent Lap Filtering)
- [x] Task: Create tests for Auto-Lap Filtering. Write unit tests for different sports (Swimming, Cycling, Running) with technical lap distances (100m, 1km, etc.) and low variance.
- [x] Task: Implement Sport-Specific Auto-Lap Filter. Update the logic to ignore 50m/100m/200m/400m for Swimming and 1km/5km for others.
- [x] Task: Implement Variance Check. Add the logic to classify as "Endurance" if remaining/filtered lap variance is below the calibrated `x%`.
- [x] Task: Verify Filtering Tests. Run tests and ensure Strategy B is correctly applied for unplanned sessions.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Implementation of Strategy B' (Protocol in workflow.md)

## Phase 4: Non-Regression & Production Reprocess
- [x] Task: Final Non-Regression Check. Run all classification tests, specifically verifying that Séraphin's session (true intervals) remains classified as "Intervalles".
- [x] Task: Production Database Update. Run a reprocess script (e.g., using `scripts/run_ingest.py` with `--force`) to update the 3 target sessions in the Supabase production database.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Non-Regression & Production Reprocess' (Protocol in workflow.md)
