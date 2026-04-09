-- Per-section coach comments (JSONB: { "form_analysis": "...", "zone_distribution": "...", ... })
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS section_comments jsonb;

COMMENT ON COLUMN public.activities.section_comments IS
'Per-section coach comments in Analyse approfondie. Keys: form_analysis, zone_distribution, decoupling, intervals_chart, intervals_detail, target_vs_actual, segment_analysis, phase_comparison';
