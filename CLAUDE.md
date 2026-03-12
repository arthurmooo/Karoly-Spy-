# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project K** is a triathlon coaching analytics platform for coach Karoly Spy. It ingests .FIT files from athletes' sport watches, aligns recorded data with planned workouts, and computes physiological metrics (load, durability, interval precision). The system runs automated ingestion every 2 hours via GitHub Actions.

## Commands

```bash
# Install dependencies
pip install -r deps.txt

# Environment setup
cp .env.example .env  # then fill in credentials

# Main CLI (3 subcommands)
python run_k.py ingest --days 14              # ingest from Nolio API
python run_k.py ingest --athlete "Adrien"     # single athlete
python run_k.py reprocess --athlete "Karoly"  # recalculate metrics
python run_k.py audit                         # health check

# Tests
pytest tests/ -v
pytest tests/test_interval_matcher.py -v      # single test file

# Database (Supabase CLI)
supabase start                                # local dev
supabase link --project-ref <ID>              # connect to remote
supabase db push                              # apply migrations
```

## Architecture

### Processing Pipeline

```
Nolio API → IngestionRobot (run_ingest.py)
  → UniversalParser.parse(.fit) → (df_1hz, device_meta, laps)
  → NolioPlanParser / TextPlanParser → target_grid
  → ActivityClassifier.detect_work_type() → "endurance|intervals|competition"
  → MetricsCalculator.compute() + IntervalMatcher.match()
  → ActivityWriter → Supabase DB
```

### Key Modules

| Module | Role |
|--------|------|
| `projectk_core/processing/parser.py` | FIT/TCX parsing → 1Hz DataFrame + laps |
| `projectk_core/processing/interval_matcher.py` | V4 hybrid LAP-first + signal fallback matcher |
| `projectk_core/processing/plan_parser.py` | Nolio JSON parser (primary) + text fallback |
| `projectk_core/processing/calculator.py` | MLS load index, durability, decoupling |
| `projectk_core/logic/reprocessor.py` | Re-calculate metrics for existing DB activities |
| `projectk_core/logic/classifier.py` | Work type detection (endurance/intervals/competition) |
| `projectk_core/logic/interval_detector.py` | Orchestrates detection; `_adapt_output()` computes `interval_pace_mean/last` |
| `projectk_core/db/connector.py` | Supabase client wrapper (prioritizes system env vars over .env) |
| `projectk_core/db/writer.py` | Activity serialization → DB |
| `run_k.py` | Master CLI entry point |

### Parser Priority

`NolioPlanParser` (Nolio structured_workout JSON) > `TextPlanParser` (offline fallback). TextPlanParser interprets `N'` as N km, not N minutes.

### Interval Matching Strategy

1. **LAP-first** — if athlete pressed lap button on watch, use Garmin LAP data
2. **Signal fallback** — adaptive hysteresis edge detection on pace/power streams
3. Every match gets a `confidence` score and `detection_source` (plan|lap|algo)

LAP avg_speed: `lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)`

## Data Conventions

- **Speed:** m/s internally. Display: `km/h = m/s × 3.6`, `min/km = 1000 / (m/s × 60)`
- **Power:** Watts (bike), m/s-derived pace (run)
- **Distance:** meters. **Duration:** seconds. **HR:** BPM
- **Time:** ISO 8601 UTC timestamps
- **Distance-weighted pace** = `total_time / total_distance` (not arithmetic mean of speeds)
- **No DataFrame for-loops** — always use vectorized Pandas/NumPy operations

## Database

Supabase/PostgreSQL with these key tables:
- `athletes` — roster with `nolio_id`
- `physio_profiles` — LT1/LT2/CP thresholds (SCD Type 2, versioned by `valid_from`)
- `activities` — all computed metrics, interval summaries, file references
- `activity_intervals` — per-interval detail (JSONB metrics, confidence, source)
- Coach dashboard views: `view_intervals_karo`, `view_weekly_monitoring`, `view_live_flux`

Migrations tracked in `supabase/migrations/` (applied via `supabase db push`).

## CI/CD

`.github/workflows/robot_v8.yml` — runs `python run_k.py ingest --days 3` every 2 hours on Ubuntu/Python 3.10. Uses GitHub Secrets for all credentials.

## Frontend

**Next.js 16** (App Router) + Supabase Auth + Tailwind CSS 4. Source in `web/`.

### Branding (Karoly Spy)

- **Bleu marine** (`~#2563EB`) — couleur dominante : nav, titres, icônes, éléments structurels
- **Orange vif** (`~#F97316`) — accent : CTAs, boutons, highlights, badges
- **Fond** : blanc clean (light) / zinc-950 (dark)
- **Style** : pro, sport, épuré — pas de fioritures. Coaching triathlon haut niveau.
- **Dark / Light mode** : toggle utilisateur obligatoire. Les deux thèmes doivent être supportés sur toutes les pages.
- Utiliser le skill `frontend-design` (`.claude/skills/frontend-design/SKILL.md`) pour toute création de composant/page UI.

### Legacy

Retool (Phase 1) consumes Supabase views directly. Key views: `view_intervals_karo`, `view_weekly_monitoring`, `view_live_flux`, `view_health_radar`.

## Nolio API

- **OAuth2** with automatic token refresh via `NolioAuthenticator`. Tokens rotate and are saved to Supabase (`app_secrets` table) + `.env`.
- **Rate limits:** 500 calls/hour, 5,000 calls/day. Be very precise — never make redundant calls.
- **Manual renewal:** if refresh token expires after long inactivity, run `scripts/auth_nolio_manual.py` (generates a URL, paste the return code).

## Workflow & Constraints

- **Mono-coach system** — built for Karoly only, not multi-tenant
- **Git:** everything on `main`. User reviews all changes before commit.
- **No pre-commit hooks** configured.
- All domain models use **Pydantic v2**. Type hints throughout.
- Git commits use **semantic prefixes** (feat/fix/chore), co-authored when AI-assisted
- **Service Role Key** — all DB operations require `SUPABASE_SERVICE_ROLE_KEY` (admin-level)
- **Offline mode** — `ReprocessingEngine(offline_mode=True)` works without API; `IngestionRobot` requires Nolio
- **Tests** should compare SOT (Source of Truth) provided by the coach vs algo-calculated values
- `conductor/` directory is deprecated (old task tracking) — ignore it
- `scripts/` contains ~124 scripts, mix of active and one-shot debug — be very careful not to delete functional scripts

## Current Status

Phase 1 (ingestion + metrics) delivered. Currently patching feedback from Karoly, then moving to Phase 2 (reporting) and Phase 3 (dashboard).

## Reference Docs

- `_docs/01_contexte/PROJECT_CONTEXT.md` — original project vision and directives
- `_docs/05_tech_docs/GUIDE_PASSATION_KAROLY.md` — handoff procedure (Supabase CLI, secrets, data init)
- `_docs/05_tech_docs/PROMPT_INTERVAL_MATCHER.md` — domain knowledge for interval detection
- `_docs/02_brief_devis/Brief_ProjectK_Phases2_3.docx` — client brief Phases 2 & 3
- `_docs/02_brief_devis/Devis_ProjectK_Phases2_3.docx` — devis détaillé Lot 1 + Lot 2
- `_docs/02_brief_devis/Analyses_Graphiques_Proposition.docx` — specs UI/UX et métriques
- `_docs/03_roadmap/Roadmap_Scrum_MVP_ProjectK.docx` — roadmap Scrum active (Lot 1)
