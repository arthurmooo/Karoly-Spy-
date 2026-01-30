# Track Specification: Holistic Metric Parity Audit (Logic vs. Nolio)

## Overview
This track aims to produce a high-fidelity reliability report comparing the "Intelligence Engine" (Project K core) interval detection and metric extraction against official Nolio data. The audit will focus on 10 diverse 'Interval' sessions across different athletes and hardware setups to establish a baseline of system accuracy.

**⚠️ CRITICAL CONSTRAINT:** No modifications to the core Project K logic are allowed. This is a read-only audit utilizing existing scripts or temporary diagnostic tools.

## Functional Requirements

### 1. Data Ingestion & Extraction
- **Session Selection:** Identify the 10 most recent 'Interval' sessions for a mixed athlete pool:
    - **Adrien Claeyssen:** Representing Running/Stryd data.
    - **Matthieu:** Representing diverse sensor setups (TCX/FIT).
    - **Estelle-Marie Kieffer:** Representing high-frequency HRV/Running data.
- **Nolio Ground Truth:** Retrieve official 'laps' (segments) via Nolio API (Endpoint investigation required: `activity` or `workout`).
- **Project K Logic:** Run the Interval Engine using `scripts/run_ingest.py` (and relevant debug flags) to extract detected intervals.

### 2. Comparative Analysis Axes
- **Parity Metrics:** Detailed % variance for:
    - Power (Watts)
    - Heart Rate (BPM)
    - Pace (min/km or m/s)
    - Distance (m)
    - Duration (s)
- **Matching Strategy:** Use **Timestamp Alignment** to correlate detected intervals with Nolio laps based on temporal overlap.
- **Strategy Comparison:** Explicitly compare the performance of:
    - **Strategy A (Plan-Driven):** Classification based on the theoretical workout plan.
    - **Strategy C (PureSignalMatcher):** Classification based on signal analysis (Plateaus, DoM).
- **Contextual Factors:**
    - **Hardware Impact:** Correlation between parity results and device type.
    - **Classification Accuracy:** Verification of "Strict Plan Priority" success.
    - **Environmental Context:** Impact of temperature/humidity on metric drift.

### 3. Reporting & Output
- **Format:** A professional Markdown "Audit Report" designed for coach review.
- **Excel-like Views:** Structured tables showing structural parity and metric deviations per interval.
- **Summary Verdict:** Identification of robust vs. drifting session types.

## Non-Functional Requirements
- **Token/API Efficiency:** Strict limit of 10 sessions. Maximize use of local cache for Nolio data.
- **Professionalism:** Tone must be technical, precise, and reassuring for Karoly.

## Acceptance Criteria
- [ ] Retrieval of official Nolio laps for 10 sessions across the specified athletes.
- [ ] Generation of a comparison table for each session (Project K vs. Nolio).
- [ ] Comparative summary of Strategy A vs. Strategy C performance.
- [ ] Final "State of Detection System" document integrated into project documentation.

## Out of Scope
- Modifications to `projectk_core` logic.
- Fixing detected drifts (this is an observation/audit track).
- Analysis of "Endurance" sessions (focus is strictly on Intervals).
