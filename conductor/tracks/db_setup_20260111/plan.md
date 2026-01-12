# Plan: [Phase 1 - Week 1] Database & Athlete Registry Setup

## Phase 1: Infrastructure & Environment
- [x] **Task: Setup Supabase Project** [commit: setup-supabase]
    - Project 'Project K' created (ayczcnoxgaljkyiljill).
    - Setup `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- [x] **Task: Environment Configuration** [commit: setup-env]
    - Initialize Python environment.
    - Setup `.env` with `NOLIO_CLIENT_ID` and `OPENWEATHER_API_KEY`.
- [x] Task: Conductor - User Manual Verification 'Infrastructure & Environment' (Protocol in workflow.md) [checkpoint: infra-ready]

## Phase 2: Database Schema
- [x] **Task: Define SQL Tables** [commit: apply-schema]
    - Create `athletes` and `athlete_devices`.
    - Create `physio_profiles` with SCD Type 2 logic (valid_from, valid_to).
    - Create `activities` with enrichment columns.
- [x] **Task: Apply Schema to Supabase** [commit: apply-schema]
    - Run SQL migrations.
- [ ] Task: Conductor - User Manual Verification 'Database Schema' (Protocol in workflow.md)

## Phase 3: Import du "Passé" (Legacy Excel)
- [~] **Task: Parser les CSV de Karoly** [commit: 61d1711]
    - Create a script to transform Excel/CSV tabs into `athletes` and `profiles` rows. (Athletes imported)
- [ ] **Task: Peupler les Profils Physio**
    - Initialize LT1/LT2 thresholds for each athlete.

## Phase 4: Bridge & Logique de Profil
- [x] **Task: Implement Base Database Connector** [commit: 80fa763]
    - Create OOP classes for Supabase interaction.
- [x] **Task: Implement Profile Retrieval Logic** [commit: 229c534]
    - Code the logic to fetch the correct `physio_profile` for any given date.
- [ ] **Task: Validation Script**
    - Write a script to verify the "Profile Loaded" requirement.
- [ ] Task: Conductor - User Manual Verification 'Core Bridge & Profile Logic' (Protocol in workflow.md)

## Phase 5: External Connectors Scaffolding
- [ ] **Task: Nolio API Basic Client**
    - Implement authentication and basic activity listing.
- [ ] **Task: OpenWeatherMap Basic Client**
    - Implement historical weather retrieval.
- [ ] Task: Conductor - User Manual Verification 'External Connectors Scaffolding' (Protocol in workflow.md)
