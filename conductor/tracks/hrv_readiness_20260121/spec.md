# Specification - Track: HRV & Daily Readiness Integration

## Overview
**Goal:** Implement a centralized system to track athlete health markers (HRV, RHR, Sleep) from Nolio to monitor recovery and readiness levels.

**Context:** While Project K focus is currently on workout analysis, monitoring the "Athlete's engine" state (readiness) is critical for Karoly to adjust training loads proactively.

## Functional Requirements
1. **Health Data Ingestion:**
    - Extend `NolioClient` to fetch daily metadata from the `/get/user/meta/` or dedicated health endpoints.
    - Retrieve: `RMSSD` (HRV), `Resting HR`, `Sleep Duration`, and `Sleep Score`.
2. **Readiness Database Storage:**
    - Create a new table `daily_readiness` indexed by `athlete_id` and `date`.
3. **Automated Synchronization:**
    - Integrate health data sync into the existing GitHub Action (scheduled for early afternoon).
4. **Physiological Baseline Calculation:**
    - Implement logic to calculate a **30-day rolling average** for RMSSD and RHR.
    - Identify significant deviations (e.g., current value vs. monthly baseline).

## Technical Requirements
- **Database:** Migration script for the `daily_readiness` table.
- **Ingestion:** Update `IngestionRobot` to handle health metrics during the daily scan.
- **Logic:** Add a `ReadinessCalculator` module to compute monthly baselines and trends.
- **Storage:** Ensure data is stored with UTC normalization for cross-athlete comparison.

## Acceptance Criteria
- [ ] New `daily_readiness` table exists in Supabase.
- [ ] The ingestion robot successfully retrieves RMSSD and Sleep data for an active athlete from Nolio.
- [ ] Monthly baselines are correctly computed and updated in the DB after each sync.
- [ ] No regression on activity ingestion (Workout sync remains stable).

## Out of Scope
- Building the front-end dashboard for readiness (deferred to Phase 2/3).
- HRV-driven automated workout adjustment (Coach remains the sole decision-maker).
