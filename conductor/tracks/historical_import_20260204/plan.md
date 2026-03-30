# Plan: Historical Data Import Engine (Night Owl)

## Phase 1: Foundation & State Management
- [ ] Task: Create `import_state` table in Supabase
    - [ ] Create migration file (SQL) for `import_state` (athlete_id, last_imported_date, status, updated_at).
    - [ ] Apply migration to Supabase.
- [ ] Task: Create State Management Module (`projectk_core/processing/history_state.py`)
    - [ ] Implement `get_athlete_state(athlete_id)`: returns the date to start fetching from.
    - [ ] Implement `update_athlete_state(athlete_id, new_date)`: updates the cursor.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Core Import Logic
- [ ] Task: Create `scripts/run_historical_import.py` script
    - [ ] Implement "Night Owl" Batch Controller (Max 400 requests/run, stop if hit).
    - [ ] Implement `fetch_week_history(athlete, date_end)` using `NolioClient`.
    - [ ] Integrate existing processing logic:
        - [ ] Reuse `process_activity_data` (FIT/JSON).
        - [ ] Reuse `upload_to_storage`.
        - [ ] Reuse `insert_activities_db`.
    - [ ] Implement Backward Iteration Logic:
        - [ ] Loop: Fetch week -> Process -> Update State -> Repeat.
        - [ ] Stop condition: Reach target date (6 months ago) OR limit hit.
- [ ] Task: Test Import Logic Locally
    - [ ] Run script manually for 1 athlete (dry-run mode).
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Automation & Deployment
- [ ] Task: Create GitHub Action Workflow (`.github/workflows/history_import.yml`)
    - [ ] Schedule: Cron `0 1-5 * * *` (Runs at 1am, 2am, 3am, 4am, 5am).
    - [ ] Env Vars: Map secrets (NOLIO_CLIENT_ID, SUPABASE_URL, etc.).
    - [ ] Step: Run `python scripts/run_historical_import.py`.
- [ ] Task: Final Integration Test
    - [ ] Trigger the workflow manually via GitHub UI.
    - [ ] Verify logs and DB insertion.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
