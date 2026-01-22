# Implementation Plan - Track: HRV & Daily Readiness Integration

## Phase 1: Database & Model Preparation [checkpoint: 4f4d95c]
- [x] Task: Create a DB migration to establish the `daily_readiness` table. d39b117
    - [ ] Columns: `athlete_id`, `date` (primary key composite), `rmssd`, `resting_hr`, `sleep_duration`, `sleep_score`, `rmssd_30d_avg`, `resting_hr_30d_avg`.
- [x] Task: Create a Pydantic model `DailyReadiness` in `projectk_core/logic/models.py`. b0f97da
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Nolio Ingestion Extension
- [x] Task: Update `NolioClient` in `projectk_core/integrations/nolio.py` to fetch daily health metadata. d7075ec
    - [ ] Implement `get_athlete_health_metrics(athlete_id, days)`.
- [ ] Task: Enhance `IngestionRobot` in `scripts/run_ingest.py` to include a health sync step.
    - [ ] Add logic to specifically trigger health sync during the afternoon run.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Readiness Logic & Baselines
- [ ] Task: Implement `ReadinessCalculator` in `projectk_core/processing/readiness.py`.
    - [ ] Logic: Fetch last 30 entries for an athlete and compute means.
    - [ ] Handle missing days gracefully (interpolation or gap).
- [ ] Task: Write unit tests for baseline calculations with mock data.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Validation
- [ ] Task: Wire the calculator into the ingestion robot's post-sync process.
- [ ] Task: Run a real-world test for an athlete known to have HRV data (e.g., Estelle-Marie Kieffer).
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
