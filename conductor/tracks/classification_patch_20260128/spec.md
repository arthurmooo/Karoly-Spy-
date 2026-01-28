# Specification: Classification Priority Patch (Interval vs. Endurance)

## Overview
This track aims to implement a surgical, non-destructive patch to the activity classification logic. Currently, some sessions containing structural interval patterns (e.g., "5-6") are being misclassified as "Endurance" because they also contain intensity zone tags (e.g., "Z2"). This patch will enforce a priority rule where structural patterns take precedence over intensity mentions, even when they are physically adjacent.

## Problem Statement
- **Anomaly Example:** Laurent Lemonnier - "TrainingPeaks Virtual - Workout: 5-6--Z2--"
- **Current Behavior:** Classified as "Endurance" (likely because of "Z2").
- **Expected Behavior:** Classified as "Intervalle" (because of "5-6" structure).

## Functional Requirements
1.  **Priority Rule:** If a session description matches a structural interval pattern, it must be classified as "Intervalle". This structural indicator is the primary signal; any intensity zones (Z1/Z2) mentioned in the same string are secondary.
2.  **Structural Pattern Matching:**
    - Support hyphenated patterns: `[0-9]+-[0-9]+` (e.g., "5-6").
    - Support multiplier patterns: `[0-9]+\s*[x*]\s*[0-9]+` (e.g., "5x6", "5 * 6").
3.  **Adjacency Handling:** The rule must trigger even if the intensity zone is attached to the pattern without separators (e.g., "5-6Z2", "5x10-Z3").
4.  **Intensity Tags (Low Priority):** The priority rule specifically applies to `Z[0-9]` patterns (Z1, Z2, Z3, etc.).
5.  **Non-Destructive Implementation:** The patch must act as an override layer or a specific condition within the existing logic without refactoring the stabilized core classification engine.

## Non-Functional Requirements
1.  **Efficiency:** Minimize API calls to Nolio. Use local cache/database context for all testing and logic validation.
2.  **Robustness:** The patch must not alter the classification of existing sessions that do not contain these conflicting indicators.

## Acceptance Criteria
1.  The anomaly session (Laurent Lemonnier, "5-6--Z2--") and adjacent examples (e.g., "5-6Z2") are correctly classified as "Intervalle".
2.  **Non-Regression Test:** A local test run on 10 existing sessions (5 "Endurance", 5 "Intervalle") shows 0% change in their current classification.
3.  The implementation is isolated and clearly documented as a "Classification Priority Patch".

## Out of Scope
- Global refactoring of the classification engine.
- Adding support for non-numeric intensity keywords (e.g., "LIT", "Recovery") in this specific priority rule.
- Mass re-synchronization of the Nolio database.
