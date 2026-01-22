# Track Specification: Mathematical Fidelity Audit (MLS & EF/Drift)

## Overview
The goal of this track is to perform a comprehensive "Parity Audit" to ensure that the current Python implementation (`projectk_core`) is 100% faithful to the original logic developed by Karoly Spy in his Jupyter notebooks. We aim for mathematical identity in the calculation of core performance metrics.

## Functional Requirements

### 1. Parity Testing Framework
- Develop a specialized testing utility that can run a raw `.FIT` file through both the current system and the "Reference Notebook Logic".
- Compare the resulting metrics: `MLS Score`, `Efficiency Factor (EF)`, and `Drift % (Pa:HR)`.

### 2. Metric-Specific Audits
- **MLS (Mixed Load Score):**
    - Verify exact alignment of intensity bins and weighting factors (0.8, 1.0, 1.2, 1.4).
    - Validate the implementation of `alpha_int` and `beta_dur` coefficients.
    - Confirm handling of CP (Critical Power) vs CS (Critical Speed) based on sport type.
- **EF & Drift:**
    - Verify the calculation of the two-halves split for decoupling.
    - Ensure EF calculation (Power/HR or Speed/HR) matches the notebook's rounding and averaging methods.

### 3. Edge Case Validation (Bulletproof Scope)
- **Multi-Sport Support:** Test with Cycling (Power-based) and Running (Speed-based) files.
- **Pause Handling:** Ensure sessions with gaps > 10s are filtered/treated exactly as per the notebook's cleaning logic.
- **Intensity Profiles:** Validate on both steady-state (endurance) and high-variability (intervals) sessions.
- **Drift Sensitivity:** Test on long sessions (> 2h) where decoupling is most prevalent.

## Non-Functional Requirements
- **Precision Tolerance:** Results must be identical within a margin of < 0.1% (allowing for minor floating-point or rounding differences between systems).
- **Traceability:** Any discrepancy found must be documented with a clear explanation of whether it's an implementation bug or a deliberate improvement.

## Acceptance Criteria
- [ ] An automated parity report is generated for a representative set of test files.
- [ ] The report shows 0% significant deviation (beyond tolerance) for MLS, EF, and Drift.
- [ ] The `projectk_core` implementation is certified "100% Karoly-Aligned".

## Out of Scope
- Auditing HRV/Readiness logic (to be handled in a future track).
- Any modifications to the Nolio ingestion API or Supabase schema.
- Frontend/Dashboard display logic.
