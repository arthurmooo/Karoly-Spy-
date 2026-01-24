# Implementation Plan - Interval Detection 2.0 (Infaillible)

## Phase 1: Audit & Diagnostic [checkpoint: 0e41a09]
- [x] Task: Create detailed audit script `scripts/audit_interval_precision.py` [e3e236b]
    - [x] Implement data extraction for current interval detection
    - [x] Add sport-specific metrics (Speed for Run, Power for Bike) + HR in logs
    - [x] Support targeted audit for specific athletes/dates (e.g., Adrien Claeyssen)
- [x] Task: Execute Audit on known problematic sessions [e3e236b]
    - [x] Run audit on Jan 7 session (Adrien) - *Substituted with Jan 14 due to missing data*
    - [x] Log results to identify specific failure modes (e.g., missed laps, bad recovery detection)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Audit & Diagnostic' (Protocol in workflow.md)

## Phase 2: Planned Structure Integration [checkpoint: 01c4b63]
- [x] Task: Implement Nolio API Planned Structure Retrieval [f7f4dce]
    - [x] Write tests for retrieving structured blocks/reps from Nolio API
    - [x] Implement the retrieval logic in `projectk_core/integrations/nolio_api.py`
- [x] Task: Implement Text-based Plan Parser (Fallback) [3d7b19b]
    - [x] Write tests for parsing titles like "10x 30/30" or "3x 2000m"
    - [x] Implement regex-based parser for common workout patterns
- [x] Task: Create Universal Plan Model [3d7b19b]
    - [x] Define a Pydantic model to represent a planned structure (count, duration/distance, intensity target)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Planned Structure Integration' (Protocol in workflow.md)

## Phase 3: Structural Matching Logic [checkpoint: pending]
- [x] Task: Develop "Consistency Score" Algorithm [27060fb]
    - [x] Write tests for matching FIT laps against a planned structure
    - [x] Implement logic to compare Lap count, total duration, and individual durations
    - [x] Handle "Contiguous Blocks" (no rest between different intensities)
- [x] Task: Implement Lap Validator [27060fb]
    - [x] Create a service that decides if a file's Laps are "Trustworthy" or "Corrupted"
- [x] Task: Conductor - User Manual Verification 'Phase 3: Structural Matching Logic' (Protocol in workflow.md)

## Phase 4: Hybrid Segmentation Engine [checkpoint: pending]
- [x] Task: Implement Signal-based Redetection (Fallback Branch) [05154fe]
    - [x] Write tests for detecting intervals when laps are missing/wrong
    - [x] Implement "Step Change" detection using moving averages (Speed/Power)
    - [x] Implement "Pattern Fitting" (finding the N expected intervals in the signal)
- [x] Task: Integrate Hybrid Logic in `IntervalDetector` [05154fe]
    - [x] Branch A: Use Laps if Validated
    - [x] Branch B: Use Redetection if Laps rejected
- [x] Task: Handle Pauses & Edge Cases [05154fe]
    - [x] Ensure pauses (auto-pause or manual) don't break the interval count
- [x] Task: Conductor - User Manual Verification 'Phase 4: Hybrid Segmentation Engine' (Protocol in workflow.md)

## Phase 5: Metrics & Integration [checkpoint: 720c1a7]
- [x] Task: Update Metrics Calculation to use Corrected Segments [fa9a605]
    - [x] Ensure MLS and other physiological indices use the output of the new engine
    - [x] Verify "Last Interval" and "Average Interval" calculations
- [x] Task: Final End-to-End Verification [fa9a605]
    - [x] Run `scripts/run_ingest.py` on diverse sessions to confirm stability
- [x] Task: Conductor - User Manual Verification 'Phase 5: Metrics & Integration' (Protocol in workflow.md)
