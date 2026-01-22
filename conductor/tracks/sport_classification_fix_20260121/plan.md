# Implementation Plan - Track: Sport Classification & Source Mapping Fix

## Phase 1: Database Schema & Model Updates
- [x] Task: Create a DB migration to add the `source_sport` column to the `activities` table.
- [x] Task: Update the `ActivityMetadata` Pydantic model in `projectk_core/logic/models.py` to include `source_sport`.
- [x] Task: Update the `ActivityWriter.serialize` method in `projectk_core/db/writer.py` to map the new field.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Ingestion Logic Refactoring
- [x] Task: Update `get_internal_sport` and `sport_map` in `scripts/run_ingest.py` with the prioritized category logic.
    - [x] Prioritize `Bike` and `Swim` detection.
    - [x] Map `Marche` to `Strength`.
- [x] Task: Modify the `process_activity` loop in `run_ingest.py` to populate both `internal_sport` and `nolio_sport` (source).
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Core Logic Alignment
- [x] Task: Update `_get_sport_category` in `projectk_core/processing/calculator.py` to ensure "Marche" follows the `Strength` calculation path (HR/RPE).
- [x] Task: Write unit tests in `tests/test_classifier.py` to verify the new mapping priority and "Marche" classification.
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Validation & Tooling
- [x] Task: Update `scripts/fix_history_sports.py` to include the new `source_sport` column update once production credits are available.
- [x] Task: Run a single-athlete ingestion test (`python3 scripts/run_ingest.py --athlete "Ilan" --days 2`) and verify columns in Supabase.
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)