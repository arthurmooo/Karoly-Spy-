# Implementation Plan: Classification Priority Patch

This plan outlines the steps to implement a surgical patch to the activity classification logic, ensuring structural patterns (e.g., "5-6", "5x10") take precedence over intensity tags (e.g., "Z2"), even when adjacent.

## Phase 1: Analysis & Test Setup
- [x] Task: Locate and analyze the current classification logic in `projectk_core/logic/` (likely `classifier.py` or similar).
- [x] Task: Create a reproduction test script `scripts/reproduce_classification_issue.py` that demonstrates the misclassification of "5-6--Z2--" and "5-6Z2".
- [x] Task: Identify 10 existing sessions in the database (5 Endurance, 5 Intervalle) to use as a non-regression sample.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Analysis & Test Setup' (Protocol in workflow.md)

## Phase 2: Implementation (TDD)
- [x] Task: Write unit tests in `tests/test_classification_patch.py` covering:
    - [x] Basic pattern: "5-6--Z2--" -> Intervalle
    - [x] Multiplier pattern: "5x10-Z3" -> Intervalle
    - [x] Adjacent pattern: "5-6Z2" -> Intervalle
    - [x] Standard Endurance: "Sortie Z2" -> Endurance (No change)
    - [x] Standard Interval: "10x400m" -> Intervalle (No change)
- [x] Task: Implement the "Classification Priority Patch" as an override layer in the classification engine.
    - [x] Add regex-based detection for structural patterns: `[0-9]+-[0-9]+` and `[0-9]+\s*[x*]\s*[0-9]+`.
    - [x] Ensure the detection triggers even if attached to "Z[0-9]".
- [x] Task: Verify that all new unit tests pass.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Implementation (TDD)' (Protocol in workflow.md)

## Phase 3: Validation & Non-Regression
- [x] Task: Run the non-regression test against the 10 identified sessions and verify 0% change in their status.
- [x] Task: Run the reproduction script `scripts/reproduce_classification_issue.py` to confirm the fix for the anomaly case.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Validation & Non-Regression' (Protocol in workflow.md)

## Phase 4: Cleanup
- [x] Task: Remove temporary reproduction scripts.
- [x] Task: Final code review to ensure the patch is isolated and documented.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Cleanup' (Protocol in workflow.md)
