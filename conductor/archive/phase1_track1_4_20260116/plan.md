# Plan: [Phase 1 - Track 1.4] The Master Script & Delivery

**Context:** This is the final integration track for Phase 1. We are assembling the "Ingestion Robot" (Track 1.3), the "Processing Engine" (Track 1.2), and the Database (Track 1.1) into a single, cohesive executable: `run_k.py`.

**Objective:** Provide Karoly with a simple command-line interface (or clickable script) to manage the entire data pipeline.

## 1. The Master CLI (`run_k.py`)
- [x] **Task: Scaffold CLI Structure** [1dfa737]
    - Create `run_k.py` at the project root.
    - Use `argparse` (or `click`) to define modes:
        - `ingest`: Run the Nolio sync (wrapper around `IngestionRobot`).
        - `reprocess`: Re-calculate metrics for existing DB activities (without Nolio calls).
        - `audit`: Check DB health (missing profiles, duplicates).
    - Ensure beautiful logging (Rich or Colorlog).
- [x] **Task: Integrate Ingestion Module** [1dfa737]
    - Link `run_k.py ingest` to `scripts/run_ingest.py` logic.
    - Expose flags: `--days`, `--athlete`.
- [x] **Task: Implement Reprocessing Mode**
    - **Why?** If we update the algorithm (Track 1.2) or fix a profile, we need to update past activities without re-downloading them.
    - Logic: Fetch `activities` from DB -> Re-run `MetricsCalculator` -> Update `activity_metrics`.

## 2. Refinement & Hardening
- [x] **Task: Global Exception Handling**
    - Ensure `run_k.py` never crashes hard. Capture errors, log them to `logs/project_k.log`, and print a friendly summary.
- [x] **Task: UTC/Timezone Standardization**
    - Review all datetime handling to ensure everything stored in DB is strict UTC.

## 3. Delivery Prep
- [x] **Task: Requirements & Setup Script**
    - Freeze `requirements.txt`.
    - Create a `setup_env.sh` (or `.bat` for Windows if needed, though Karoly is on Mac?) -> *Karoly uses Mac*.

## 4. Final Validation (Recette)
- [x] **Task: End-to-End Test**
    - Run `python run_k.py ingest --days 7`.
    - Run `python run_k.py reprocess --athlete "Adrien"`.
    - Verify results in Supabase Dashboard.
