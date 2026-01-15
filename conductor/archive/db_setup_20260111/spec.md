# Spec: [Phase 1 - Week 1] Database & Athlete Registry Setup

## Goal
Establish the core data infrastructure on Supabase and implement the athlete registry with historical physiological profile tracking (SCD Type 2). Prepare the system for enriched data ingestion (RPE, Weather, Grade, Cadence, Stryd).

## Requirements

### Database Schema (Supabase/PostgreSQL)
- **Table `athletes`**: Basic metadata (name, start date, active status).
- **Table `athlete_devices`**: Mapping of multiple serial numbers per athlete (Relation 1-N).
- **Table `physio_profiles`**: SCD Type 2 tracking for:
    - LT1, LT2 (Heart Rate & Power/Pace)
    - CP (Critical Power) / CS (Critical Speed)
    - Weight, VMA (Vitesse Maximale Aérobie).
- **Table `activities`**: Core storage for results:
    - Metadata: Nolio ID, Date, Sport Type, RPE, Weather (Temp/Humidity).
    - Calculated Metrics: Load, Durability, Decoupling, Avg Power/Pace (Moving Time).
    - Storage Link: Reference to .FIT file in Supabase Storage.

### Data Enrichment Logic
- **Weather**: Connector for OpenWeatherMap API (fallback to device temp).
- **RPE**: Retrieval from Nolio API with daily retry script for missing values.
- **Physics**: Calculation of lissed Grade (30s window) and Moving vs Elapsed averages.

### Infrastructure
- Secure bridge using `.env` for Nolio, OpenWeatherMap, and Supabase keys.
- Directory structure for `projectk-core` library.

## Verification Criteria
- [ ] Supabase project initialized and accessible.
- [ ] SQL Schema applied successfully.
- [ ] Python script can load an athlete profile and correctly retrieve the valid thresholds for a specific historical date.
- [ ] Connector test: Successfully ping Nolio and OpenWeatherMap APIs.
