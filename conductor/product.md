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
-   **Multi-Format Support:** Robust parsing of `.FIT`, `.TCX`, and `.GZ` compressed files to support a wider range of devices (e.g., Polar, older Garmins).
-   **Onboarding Strategy:** Rolling window import (last 3-6 months) for immediate relevance.
-   **Hardware Mapping:** Automatic athlete attribution via Device Serial Numbers found in .FIT files.
-   **Data Enrichment:**
    -   **General:** RPE (from Nolio metadata or manual input), Temperature (from device sensors).
    -   **Cycling:** Slope/Grade (%), Cadence (rpm).
    -   **Running:** Slope/Grade (%), Cadence (spm), Stryd Power (Watts) when available.
    -   **Health:** RMSSD (HRV), Resting Heart Rate, Sleep Duration, Sleep Score.

### 2. The "Intelligence Engine" (Python Core)
- **Physiological Brain:** High-precision calculation of Load (MLS), Durability, and Decoupling. **100% certified alignment** with Karoly's original mathematical models (strict exclusion of pauses, precise split-halves by time). Note: MLS calculation is strictly restricted to Running and Cycling activities to ensure scientific validity.
- **MLS Parity & Calibration:** Advanced "Calorie-equivalent" model for Running (MEC) that aligns Running Load with Cycling Load (e.g., 1h Run @ 120bpm ≈ 1h Bike @ 120bpm), removing historical conversion biases (Run Coeff 0.77 vs legacy 4.184).
- **Hybrid Interval Engine:** Surgical segmentation of complex workouts using a four-tier fusion strategy: theoretical plan correlation, manual/automatic lap analysis, ULTRA signal analysis (Histogram Valley), and **PureSignalMatcher** (DoM edge detection, Cadence Snap alignment, and Plateau Validation).
- **Smart Classification & Interval Metrics:** Automated extraction of physiological markers (Avg Speed/Power, HR, Pa:Hr Ratio, internal Decoupling) for every detected effort block. Advanced classification logic prevents "Endurance" sessions from being misclassified as "Intervalles" by enforcing **Strict Plan Priority** (Strategy A) and **Intelligent Lap Filtering** (Strategy B) to ignore device-generated Auto-Laps (e.g., 1km, 5km, 100m) based on duration/intensity variance checks.
-   **Magnitude Rule:** Automatic intelligence to switch between Stryd Power (Watts) and Critical Speed (m/s) based on threshold magnitudes (CP > 100 vs CS < 20), ensuring scientific validity across different sensor setups.
-   **Readiness Calculator:** Automated 30-day baseline computation for health markers to detect significant physiological deviations.
-   **Data Quality Engine:** 
    -   *Best Effort Repair:* Smoothing and interpolation for minor gaps.
    -   *Exclusion Logic:* Sessions with >20% missing data are flagged for manual review or excluded.
-   **Physio Profiles (SCD Type 2):** Historical tracking of LT1, LT2, CP/CS to ensure every activity is analyzed with the correct context.
-   **Sport-Specific Profiling:** Multi-dimensional physiological profiles allowing distinct thresholds (LT1/LT2) for different modalities (e.g., Run vs. Bike) for the same athlete, enabling precision analysis across disciplines.

### 3. Output & Consumption
-   **Automated Weekly Reporting:** Custom summaries for athletes with variable detail levels (Simplified vs. Expert).
-   **JSON API:** Structured interface for the dashboarding/frontend layer.
-   **Proactive Alerting:** Notification system for Karoly when significant physiological shifts or data anomalies are detected.

### 4. Platform Foundation
-   **Admin Control Panel:** Interface for athlete management and data validation.
-   **Scalable Architecture:** Designed to handle 100+ athletes efficiently using vectorized Python operations and Supabase.
