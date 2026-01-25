# Backlog Improvements - Project K

## Phase 2: Refinement & Scale

### Logic Improvements (Logged from Track 1.5 - Matcher V2)

- [x] **Hysteresis-based Detection**: Replaced peak-search with entry (80%) and exit (65%) thresholds. Significantly improved robustness against signal noise.
- [x] **Plateau Centering**: Implemented automated trimming (8s start / 5s end) to extract stable physiological metrics, avoiding the "ramp-up" phase.
- [x] **Dynamic Search Gaps**: Implemented a search window that scales with target duration (max of 900s or 2x duration), solving issues with long intervals (waves).
- [x] **Pace Disambiguation Heuristic**: Added a "Realistic Speed Check" (1.5 - 6.5 m/s) to differentiate between m/s, min/km, and km/h from Nolio API.

### Logic Improvements (Logged from Track: Interval Classification Fix 2026-01-23)

- [x] **Permissive Series Regex**: Replaced strict `\d+x\d+` with `\d+\s*[*x]` to catch series followed by brackets (e.g., `5*(40'' Z3...)`) or spaces.
- [x] **Discipline-Specific Keywords**: Added `tempo`, `pma`, `vameval` to `INTERVAL_KEYWORDS` to align with cycling and athletic testing terminology.
- [x] **Cross-Check Robustness**: Verified that "Tempo" classification correctly triggers surgical interval metrics (mean Power/HR) during ingestion.

- [x] **Profile-Agnostic Segmentation**: Modified `MetricsCalculator.compute` to allow calculation of `segmented_metrics` even when a physiological profile is missing. This ensures the "decouplage" KPI is populated for all activities with FIT data.
- [x] **Safe Stream Access**: Added existence checks for the `speed` column in `active_df` to prevent crashes during processing of activities without speed data (e.g., some swimming or indoor sessions).
- [x] **Resilient Ingestion**: Updated `run_ingest.py` to attempt advanced metric calculation whenever streams are present, regardless of profile availability.

### Logic Improvements (Logged from Track: Generic Classification Fix 2026-01-24)

- [x] **Generic Title Detection**: Expanded `ActivityClassifier` to include common Nolio sport names (e.g., 'Vélo - Route', 'Trail') as generic endurance titles. This prevents high signal variability (CV > 0.40) from misclassifying stop-and-go endurance rides as intervals.
- [x] **Title-Type Parity**: Implemented a direct comparison between activity title and Nolio sport type to automatically categorize "empty" titles (where title == sport name) as endurance if no plan is present.
- [x] **Safe Temporary Parsing**: Fixed a critical bug in `run_ingest.py` where the temporary file path (`tmp_path`) was used before initialization, ensuring robust parsing of FIT/TCX files during ingestion.
- [x] **Selective Interval Clean-up**: Reinforced the "Security" check in `run_ingest.py` to ensure interval-specific metrics (Plateau HR/Power) are stripped if an activity is re-classified from intervals to endurance.

### Logic Improvements (Logged from Track: Gravel & Generic Classification Fix 2026-01-24)

- [x] **Gravel Support**: Added 'Vélo - Gravel' and 'Gravel' to `generic_titles` in `ActivityClassifier`.
- [x] **Title Normalization**: Improved dash handling in activity titles (En-dash/Em-dash to Hyphen) to ensure reliable matching against generic title lists.
- [x] **Retroactive Correction**: Fixed misclassification for Estelle-Marie Kieffer (Gravel) and others in the database via SQL update.
- [x] **Plan Logic Restoration**: Re-implemented the missing logic in `run_ingest.py` to fetch and parse Nolio planned workouts (target_grid). This restores the "Strategy A" (Plan-Driven) classification, ensuring that sessions explicitly planned as intervals are detected even if the signal is messy.

### Logic Improvements (Logged from Track 1.5.D - Surgical Precision)

- [x] **Plan-Driven Seeker**: Implemented custom cross-correlation (sliding window) informed by Nolio duration to focus detection.
- [x] **Gradient Refinement**: Added sub-second edge snapping using multi-signal gradient analysis (Primary Signal + Cadence).
- [x] **Active Recovery Separation**: Successfully isolated efforts from active recoveries (e.g. 1'30/3'30) by using plan as a template.
- [x] **Sequential Matcher Re-sync**: Improved sequential pointer management to handle missed intervals or early starts.

- [ ] **Blind Gradient Refinement**: Port the `PlanDrivenSeeker`'s edge refinement logic to the blind `AlgoDetector` to improve precision even when no plan is available.
- [ ] **TCX Support**: The current parser only handles binary .fit files. One of the test files (Baptiste 01/08) is a TCX, causing a crash. Need a TCX/XML parser layer.
- [ ] **Swimming Fallback**: For swimming activities without speed/power data, implement a fallback using LAP messages or internal device distance calculations.
- [ ] **Confidence Scoring**: Refine the `respect_score` to also include a "Signal Quality" metric (e.g., standard deviation of signal during plateau).
- [ ] **Adaptive Trimming**: Adjust the plateau trim duration based on the signal's second derivative (detecting when it actually stabilizes) rather than fixed seconds.
- [ ] **HRV/rMSSD Integration**: Add support for physiological metrics (RMSSD) from Nolio's `get/user/meta/` endpoint to enhance training load and readiness analysis. confirmed available in API.### 2026-01-25: Interval Engine Fixes & Robustness\n- Fix: calculator.py missing laps pass to matcher.\n- Improvement: Dynamic intensity thresholds in IntervalMatcher (CP-based or session-mean fallback).\n- Feature: Persistence of activity_intervals in DB.
