# Plan: [Phase 1 - Week 1] Database & Athlete Registry Setup

## Phase 1: Infrastructure & Environment
- [ ] **Task: Setup Supabase Project**
    - Create project on Supabase.
    - Setup `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Task: Environment Configuration**
    - Initialize Python environment.
    - Setup `.env` with `NOLIO_API_TOKEN` and `OPENWEATHER_API_KEY`.
- [ ] Task: Conductor - User Manual Verification 'Infrastructure & Environment' (Protocol in workflow.md)

## Phase 2: Database Schema
- [ ] **Task: Define SQL Tables**
    - Create `athletes` and `athlete_devices`.
    - Create `physio_profiles` with SCD Type 2 logic (valid_from, valid_to).
    - Create `activities` with enrichment columns.
- [ ] **Task: Apply Schema to Supabase**
    - Run SQL migrations.
- [ ] Task: Conductor - User Manual Verification 'Database Schema' (Protocol in workflow.md)

## Phase 3: Core Bridge & Profile Logic
- [ ] **Task: Implement Base Database Connector**
    - Create OOP classes for Supabase interaction.
- [ ] **Task: Implement Profile Retrieval Logic**
    - Code the logic to fetch the correct `physio_profile` for any given date.
- [ ] **Task: Validation Script**
    - Write a script to verify the "Profile Loaded" requirement.
- [ ] Task: Conductor - User Manual Verification 'Core Bridge & Profile Logic' (Protocol in workflow.md)

## Phase 4: External Connectors Scaffolding
- [ ] **Task: Nolio API Basic Client**
    - Implement authentication and basic activity listing.
- [ ] **Task: OpenWeatherMap Basic Client**
    - Implement historical weather retrieval.
- [ ] Task: Conductor - User Manual Verification 'External Connectors Scaffolding' (Protocol in workflow.md)
