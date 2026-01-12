# Plan: [Phase 1 - Module A] The Processing Engine "Le Cerveau"

**Context:** This track builds the core intelligence of Project K. It transforms raw binary `.fit` data into actionable physiological metrics using robust Python OOP and vectorized calculations.

**Scope Definition (Per User Q&A):**
- **Sports:** Cycling & Running only (Phase 1).
- **Load Calculation:** Custom "Karoly Mix" (Mixed Model: HR Time in Zones + Power IF). Not standard TSS.
- **Zero Handling:** Include zeros (freewheel), but filter out "Stops" (>10s gaps).
- **Analysis Scope:** Global session metrics + Fixed Split (1st Half vs 2nd Half) for Decoupling. No Lap-by-Lap analysis.
- **Data Integrity:** "Smart Clipping" only for impossible values (e.g., >2000W sustain).
- **Configuration:** Coefficients (alpha, beta) must be stored in a **Supabase Table** to allow Karoly to tweak them without code changes.
- **Storage:** Summarized metrics in DB (`activities`), Raw `.fit` files in Storage (Track 1.3).
- **Duplicates:** Prioritize the largest file (File Size = Info Density).

## 1. Setup & Scaffolding
- [x] **Task: Configuration Schema** [567399a]
    - Create `processing_config` table in Supabase (key-value or JSON columns for `alpha_int`, `beta_dur`, etc.).
    - Create Python `AthleteConfig` class that fetches these values.
- [x] **Task: Activity & Athlete Classes** [7cdfcb4]
    - Define `Activity` class (holds dataframe, metadata, computed metrics).
    - Define `Athlete` class (holds ID, thresholds history).
    - Ensure Pydantic models for type safety.

## 2. Universal FIT Parser
- [x] **Task: Implement FIT Loader** [bf4706d]
    - Use `fitdecode` library.
    - Extract standard streams: `timestamp`, `power`, `heart_rate`, `cadence`, `altitude`, `speed`, `effort_pace` (Coros).
    - **Sanity Check:** Implement "Smart Clipping" (filter obvious outliers).
    - **Zero Handling:** Keep 0s for power averages, drop gaps > 10s (Auto-Pause logic).
    - **Deliverable:** `FitParser.parse(file_path) -> pd.DataFrame`

## 3. Vectorized Calculations (The "No-Loop" Rule)
- [x] **Task: Karoly's "Mixed Model" Load** [14cef55]
    - Implement the specific formula from `TrainingLoad.ipynb`:
        - Weighted HR Time in Zones (LT1-LT2).
        - Intensity Factor (IF) bins with custom multipliers.
        - `alpha_int` weighting.
- [x] **Task: Standard Power Metrics** [14cef55]
    - Normalized Power (NP) (standard Algo).
    - Training Stress Score (TSS) (as a comparative baseline).
- [x] **Task: Efficiency & Decoupling (Global Split)** [14cef55]
    - Calculate `Pw:Hr` ratio for 1st Half vs 2nd Half.
    - Apply `beta_dur` penalty logic if drift > 3%.

## 4. Integration & Storage
- [ ] **Task: Database Writer**
    - Method to serialize `Activity` object to Supabase `activities` table format.
    - **Note:** Do NOT store time-series JSON in DB. Store only summary results.

## 5. Validation
- [ ] **Task: Unit Tests with Real Data**
    - Test against the provided sample `.fit` file.
    - Verify calculated "Karoly Load" matches his manual notebook results.