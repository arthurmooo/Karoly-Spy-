# Implementation Plan - Holistic Metric Parity Audit

This plan outlines the steps to produce a detailed reliability report comparing Project K's interval detection against Nolio's official data, without modifying the core system logic.

## Phase 1: Discovery & Preparation
- [x] Task: Explore Nolio API endpoints (`/activity` or `/workout`) to identify the retrieval method for official laps/segments. [9f82e8c]
- [x] Task: Identify and validate 10 target sessions with a diverse mix (Adrien/Stryd, Matthieu/FIT-TCX, Estelle/HRV) and verify data availability. [9f82e8c]
- [x] Task: Ensure the local environment and cache are ready for the 10 sessions to minimize Nolio API pressure. [9f82e8c]
- [x] Task: Conductor - User Manual Verification 'Discovery & Preparation' (Protocol in workflow.md) [9f82e8c]

## Phase 2: Audit Tool Development (Diagnostic Only)
- [x] Task: Write unit tests for the `Timestamp Alignment` correlation logic to ensure accurate interval matching between Nolio and Project K. [9f82e8c]
- [x] Task: Implement `scripts/holistic_audit.py`, a temporary diagnostic script that pulls Nolio laps and Project K intervals. [9f82e8c]
- [x] Task: Integrate comparison logic for Strategy A (Plan-Driven) vs. Strategy C (PureSignalMatcher) within the audit script. [9f82e8c]
- [x] Task: Conductor - User Manual Verification 'Audit Tool Development' (Protocol in workflow.md) [9f82e8c]

## Phase 3: Audit Execution & Data Extraction
- [x] Task: Execute the audit script on the 10 selected sessions and capture raw parity metrics (Power, HR, Pace, Distance, Duration). [9f82e8c]
- [x] Task: Calculate the % variance for each metric and interval, identifying "structural drift" cases. [9f82e8c]
- [x] Task: Correlate results with Hardware Type (Garmin/Wahoo/Coros) and Environmental Context (Temp/Humidity). [9f82e8c]
- [x] Task: Conductor - User Manual Verification 'Audit Execution & Extraction' (Protocol in workflow.md) [9f82e8c]

## Phase 4: Synthesis & Final Reporting
- [x] Task: Compile the final "État du Système de Détection" document in professional Markdown. [9f82e8c]
- [x] Task: Format the "Excel-like" data tables for clear visualization of parity across the 10 sessions. [9f82e8c]
- [x] Task: Draft the technical conclusion regarding Strategy A vs. Strategy C performance and system robustness. [9f82e8c]
- [x] Task: Conductor - User Manual Verification 'Synthesis & Final Reporting' (Protocol in workflow.md) [9f82e8c]
