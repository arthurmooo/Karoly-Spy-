# Implementation Plan - MLS Sport Restriction

Restrict the Mixed Load Score (MLS) calculation to Running and Cycling sports and clean up existing database records.

## Phase 1: Core Logic Restriction
- [x] Task: Create unit tests in `tests/test_calculator.py` to verify that `mls_load` is calculated for "run" and "bike" but remains `None` for "swim", "strength", and "other".
- [x] Task: Modify `projectk_core/processing/calculator.py` to implement the sport restriction in the `compute` method. 3a7399a
- [x] Task: Verify that all tests pass and coverage for the change is >80%. 3a7399a
- [ ] Task: Conductor - User Manual Verification 'Core Logic Restriction' (Protocol in workflow.md)

## Phase 2: Database Cleanup
- [ ] Task: Create a migration or a one-time script `scripts/fix_mls_sports.py` to set `load_index = NULL` for activities where the sport is not "Run" or "Bike".
- [ ] Task: Execute the cleanup script and verify the number of affected rows.
- [ ] Task: Perform a manual spot check in the database to ensure data integrity.
- [ ] Task: Conductor - User Manual Verification 'Database Cleanup' (Protocol in workflow.md)