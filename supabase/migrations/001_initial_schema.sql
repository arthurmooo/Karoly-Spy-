-- Project K: Initial Schema (Phase 1)
-- Description: Creates all base tables, extensions, and RLS policies.
-- Date: 2026-01-25

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Athletes Table
CREATE TABLE IF NOT EXISTS public.athletes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    nolio_id text UNIQUE,
    start_date date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Athlete Devices (for hardware mapping)
CREATE TABLE IF NOT EXISTS public.athlete_devices (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
    serial_number text UNIQUE NOT NULL,
    device_name text,
    created_at timestamp with time zone DEFAULT now()
);

-- Physio Profiles Table (SCD Type 2)
CREATE TABLE IF NOT EXISTS public.physio_profiles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
    sport text NOT NULL,
    lt1_hr integer,
    lt2_hr integer,
    lt1_power_pace double precision,
    lt2_power_pace double precision,
    cp_cs double precision,
    weight double precision,
    vma double precision,
    cp_montee double precision,
    cp_ht double precision,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Activities Table (Main Store)
CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
    nolio_id text UNIQUE,
    session_date timestamp with time zone NOT NULL,
    sport_type text NOT NULL,
    source_sport text,
    activity_name text,
    duration_sec double precision,
    distance_m double precision,
    elevation_gain double precision,
    rpe integer,
    missing_rpe_flag boolean DEFAULT false,
    temp_avg double precision,
    humidity_avg double precision,
    weather_source text,
    load_index double precision,
    durability_index double precision,
    decoupling_index double precision,
    avg_power double precision,
    avg_hr double precision,
    work_type text,
    fit_file_path text,
    fit_file_hash text,
    segmented_metrics jsonb,
    interval_power_last double precision,
    interval_hr_last double precision,
    interval_power_mean double precision,
    interval_hr_mean double precision,
    interval_pace_last double precision,
    interval_pace_mean double precision,
    interval_respect_score double precision,
    interval_detection_source text,
    source_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Activity Intervals (Granular effort blocks)
CREATE TABLE IF NOT EXISTS public.activity_intervals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
    start_time double precision NOT NULL,
    end_time double precision NOT NULL,
    duration double precision NOT NULL,
    type text,
    detection_source text,
    avg_speed double precision,
    avg_power double precision,
    avg_hr double precision,
    avg_cadence double precision,
    pa_hr_ratio double precision,
    decoupling double precision,
    respect_score double precision,
    created_at timestamp with time zone DEFAULT now()
);

-- Daily Readiness (HRV, Sleep, etc.)
CREATE TABLE IF NOT EXISTS public.daily_readiness (
    athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
    date date NOT NULL,
    rmssd double precision,
    resting_hr double precision,
    sleep_duration double precision,
    sleep_score double precision,
    rmssd_30d_avg double precision,
    resting_hr_30d_avg double precision,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (athlete_id, date)
);

-- Webhook Events (Ingestion queue)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at timestamp with time zone DEFAULT now(),
    provider text DEFAULT 'nolio',
    payload jsonb,
    processed boolean DEFAULT false,
    error_message text
);

-- Processing Config (Hyper-parameters)
CREATE TABLE IF NOT EXISTS public.processing_config (
    key text PRIMARY KEY,
    value double precision NOT NULL,
    description text,
    category text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- App Secrets (Encrypted or internal keys)
CREATE TABLE IF NOT EXISTS public.app_secrets (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. RLS POLICIES (Service Role Protection)

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.athletes FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.athlete_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.athlete_devices FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.physio_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.physio_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.activities FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.activity_intervals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.activity_intervals FOR ALL TO service_role USING (true);

ALTER TABLE public.daily_readiness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.daily_readiness FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.processing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.processing_config FOR SELECT TO public USING (true);
CREATE POLICY "Enable write access for service role only" ON public.processing_config FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only" ON public.app_secrets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Note: Webhook events are usually left without RLS or with specific insert-only policies for security.
ALTER TABLE public.webhook_events DISABLE ROW LEVEL SECURITY;
