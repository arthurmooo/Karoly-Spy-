# Specification: MLS Sport Restriction

## Overview
Currently, the Mixed Load Score (MLS) is calculated for all activity types as long as mechanical load (MEC) and heart rate thresholds (LT1/LT2) are available. Karoly Spy has requested that this metric be restricted exclusively to **Running** and **Cycling** activities, as it is not scientifically validated or desired for other sports (e.g., Swimming, Strength, etc.).

## Functional Requirements
1.  **Restrict MLS Calculation:** Modify the `MetricsCalculator.compute` method to ensure `mls_load` is only calculated if the categorized sport is "run" or "bike".
2.  **Nullify for Other Sports:** For any other sport category (swim, strength, other), `mls_load` must return `None`.
3.  **Database Cleanup:** Perform a one-time update in the Supabase database to set `load_index` to `NULL` for all activities that are NOT categorized as Running or Cycling.

## Non-Functional Requirements
- **Data Integrity:** Ensure that the cleanup script accurately identifies activities to be nullified based on the system's sport categorization logic.
- **Performance:** The database update should be efficient and not cause significant downtime.

## Acceptance Criteria
- [ ] Activities categorized as "run" or "bike" continue to have `mls_load` calculated when thresholds are present.
- [ ] Activities categorized as "swim", "strength", or "other" have `mls_load` set to `None`/`NULL`.
- [ ] Existing records in the `activities` table for non-run/bike sports have their `load_index` cleared.
- [ ] Unit tests verify that `mls_load` is null for non-eligible sports.

## Out of Scope
- Modifying the underlying `mec`, `int_index`, or `dur_index` calculations.
- Changing how sports are categorized in `_get_sport_category`.