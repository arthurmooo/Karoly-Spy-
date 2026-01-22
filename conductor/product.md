# Product Guide: Project K - The "Intelligence Engine"

## Initial Concept
Le but est de libérer un maximum de temps d'administratif et de secrétariat à Karoly pour qu'il puisse concentrer son influx nerveux et son temps de travail sur là où il est le meilleur : l'amélioration de la performance.

## Vision
To transform Karoly Spy's coaching methodology into a scalable, automated, and scientifically robust software platform. The goal is to move from manual "data secretariat" to high-value "performance architecture," enabling the management of 100+ athletes with precision and ease.

## Core Value Proposition
1.  **Administrative Liberation:** Zero-friction data handling through automated ingestion, attribution, and cleaning.
2.  **Scientific "Triple Crown" Metrics:**
    -   **Holistic Load Index:** Proprietary multidimensional load calculation (Calories, RPE, Thresholds).
    -   **Durability Index:** Advanced analysis of performance maintenance over time/fatigue.
    -   **Cardiac Decoupling:** Precise Pa:Hr and Pw:Hr relationship tracking to monitor aerobic efficiency.
3.  **Readiness Monitoring:** Integration of morning health markers (HRV/RMSSD, Sleep, Resting HR) to monitor adaptation and recovery.
4.  **Data Integrity:** Hybrid cleaning logic that repairs minor sensor gaps but flags significant corruption to protect statistical validity.

## Target Audience
-   **Primary:** Karoly Spy (Admin, Head Coach, Analyst).
-   **Secondary:** Athletes (Recipients of simplified or full performance insights, depending on configuration).
-   **Tertiary:** Future scalability to other elite coaches (SaaS model).

## Key Features

### 1. Ingestion & Data Strategy
-   **Automated Sync:** Ingestion from Nolio/Strava to Supabase.
-   **Onboarding Strategy:** Rolling window import (last 3-6 months) for immediate relevance.
-   **Hardware Mapping:** Automatic athlete attribution via Device Serial Numbers found in .FIT files.
-   **Data Enrichment:**
    -   **General:** RPE (from Nolio metadata or manual input), Temperature (from device sensors).
    -   **Cycling:** Slope/Grade (%), Cadence (rpm).
    -   **Running:** Slope/Grade (%), Cadence (spm), Stryd Power (Watts) when available.
    -   **Health:** RMSSD (HRV), Resting Heart Rate, Sleep Duration, Sleep Score.

### 2. The "Intelligence Engine" (Python Core)
-   **Physiological Brain:** High-precision calculation of Load, Durability, Decoupling, and Normalized Power/Grade Adjusted Pace.
-   **Readiness Calculator:** Automated 30-day baseline computation for health markers to detect significant physiological deviations.
-   **Data Quality Engine:** 
    -   *Best Effort Repair:* Smoothing and interpolation for minor gaps.
    -   *Exclusion Logic:* Sessions with >20% missing data are flagged for manual review or excluded.
-   **Physio Profiles (SCD Type 2):** Historical tracking of LT1, LT2, CP/CS to ensure every activity is analyzed with the correct context.

### 3. Output & Consumption
-   **Automated Weekly Reporting:** Custom summaries for athletes with variable detail levels (Simplified vs. Expert).
-   **JSON API:** Structured interface for the dashboarding/frontend layer.
-   **Proactive Alerting:** Notification system for Karoly when significant physiological shifts or data anomalies are detected.

### 4. Platform Foundation
-   **Admin Control Panel:** Interface for athlete management and data validation.
-   **Scalable Architecture:** Designed to handle 100+ athletes efficiently using vectorized Python operations and Supabase.
