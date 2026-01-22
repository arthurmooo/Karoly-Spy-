# Backlog Improvements - Project K

## Phase 2: Refinement & Scale

### Logic Improvements (Logged from Track 1.5 - Matcher V2)

- [x] **Hysteresis-based Detection**: Replaced peak-search with entry (80%) and exit (65%) thresholds. Significantly improved robustness against signal noise.
- [x] **Plateau Centering**: Implemented automated trimming (8s start / 5s end) to extract stable physiological metrics, avoiding the "ramp-up" phase.
- [x] **Dynamic Search Gaps**: Implemented a search window that scales with target duration (max of 900s or 2x duration), solving issues with long intervals (waves).
- [x] **Pace Disambiguation Heuristic**: Added a "Realistic Speed Check" (1.5 - 6.5 m/s) to differentiate between m/s, min/km, and km/h from Nolio API.

### Logic Improvements (Logged from Track 1.5 - Matcher V3)

- [x] **LAP-First Hybrid Matching**: Prioritize LAP data when confidence > 70%, fallback to signal detection otherwise.
- [x] **Sequential LAP Consumption**: Use first-valid match instead of best-in-window to ensure correct 1:1 mapping.
- [x] **LAP Confidence Scoring**: Duration (50%) + Intensity (30%) + Type (20%) weighted scoring.
- [x] **NoneType Handling**: Fixed crashes when LAP data has missing power/speed values.
- [x] **Mini-LAP Filtering**: Skip LAPs < 20s to prevent sequence corruption.

### Pending Items (Phase 2)

- [ ] **TCX Support**: The current parser only handles binary .fit files. One of the test files (Baptiste 01/08) is a TCX, causing a crash. Need a TCX/XML parser layer.
- [ ] **Swimming Fallback**: For swimming activities without speed/power data, implement a fallback using LAP messages or internal device distance calculations.
- [ ] **Confidence Scoring**: Refine the `respect_score` to also include a "Signal Quality" metric (e.g., standard deviation of signal during plateau).
- [ ] **Adaptive Trimming**: Adjust the plateau trim duration based on the signal's second derivative (detecting when it actually stabilizes) rather than fixed seconds.
- [ ] **HRV/rMSSD Integration**: Add support for physiological metrics (RMSSD) from Nolio's `get/user/meta/` endpoint to enhance training load and readiness analysis. confirmed available in API.