# Implementation Plan - Track: Shift Logic Stabilization

## Phase 1: Infrastructure & Reproduction
- [ ] Task: Create `scripts/debug_tools/fetch_session.py` to fetch Nolio JSON + FIT files.
    - [ ] **Check First:** Query Supabase DB for the activity record.
    - [ ] **Fetch:** Only call Nolio API if data is missing from DB.
    - [ ] **Storage:** Save to `data/samples/debug_<athlete_name>_<YYYYMMDD>_<session_name>.json` and `.fit`.
- [ ] Task: Execute fetch for Louis Richard (Jan 27, 2026).
- [ ] Task: Create `tests/repro_shift_issue.py` to confirm the bug (assert it currently shifts to Signal for the Louis Richard case).
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Logic Implementation (The Fix)
- [ ] Task: Implement "Smart Aggregation" logic in `IntervalEngine` (merging consecutive laps if they fit a single Plan step).
- [ ] Task: Implement "Drift-Resistant Matching" strategy. Refactor the matching loop to use relative time/sequence rather than absolute timestamps.
- [ ] Task: Update the "Plan-Master" decision tree: if the sequence matches (within Hybrid tolerances), force `source='laps'`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Validation & Cleanup
- [ ] Task: Run `tests/repro_shift_issue.py` again to verify it now PASSES (correctly identifies Laps).
- [ ] Task: **Detailed Metrics Report:** Extract and display the final Pace and HR for each of the 7x2km intervals of Louis Richard for manual verification.
- [ ] Task: Verify no regression on a "pure signal" case (e.g., Fartlek without laps).
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
