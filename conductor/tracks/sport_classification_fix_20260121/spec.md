# Specification - Track: Sport Classification & Source Mapping Fix

## Overview
**Goal:** Fix the systematic misclassification of activities (where many sports defaulted to 'Run') and implement a two-tier sport tracking system (Technical Category vs. Source Name).

**Context:** The current ingestion robot uses a substring-based mapping that is too aggressive with the keyword 'Marche' and lacks priority, leading to data corruption in the `sport_type` column.

## Functional Requirements
1. **Two-Tier Sport Mapping:**
    - Update the database schema to include a `source_sport` column (String).
    - `sport_type`: Maintains technical categories (`Bike`, `Run`, `Swim`, `Strength`, `Other`) for calculation logic.
    - `source_sport`: Stores the exact label from Nolio (e.g., "Vélo - Route", "Marche").
2. **Robust Mapping Logic:**
    - Priority-based matching: Check for `Bike` and `Swim` first.
    - Categorize "Marche" as `Strength` (Technical Category) to align with Karoly's structural work philosophy.
    - Fallback unrecognized sports to `Other`.
3. **Database Migration:**
    - Add `source_sport` column to the `activities` table.
4. **Historical Cleanup (Deferred):**
    - The `fix_history_sports.py` script is implemented but its execution is deferred until Nolio API production limits are active.

## Technical Requirements
- Update `scripts/run_ingest.py` mapping logic.
- Update `projectk_core/db/writer.py` to handle the new `source_sport` field.
- Ensure `ActivityClassifier` and `MetricsCalculator` correctly interpret the new `Strength` classification for Marche.

## Acceptance Criteria
- [ ] Ingesting a "Vélo - Home Trainer" activity results in `sport_type` = 'Bike' and `source_sport` = 'Vélo - Home Trainer'.
- [ ] Ingesting a "Marche" activity results in `sport_type` = 'Strength' and `source_sport` = 'Marche'.
- [ ] Existing activities in the database remain accessible (no regression).
- [ ] The ingestion robot no longer hits 429 errors during normal 2-hour cycles.

## Out of Scope
- Global database cleanup (deferred to production phase).
- Implementing specific load calculations for `Strength` (remains RPE/HR based).
