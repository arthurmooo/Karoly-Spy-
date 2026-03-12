# CODEX MEMORY - Project K (Karoly Spy)

Updated: 2026-02-11

## 1) Mission & Product
- Project K is a triathlon coaching analytics platform for Karoly Spy.
- Goal: ingest athlete activities, align actual sessions with planned workouts, compute reliable physiological metrics, and expose coach-ready data in Supabase/Retool.
- Phase status: Phase 1 delivered; active patch cycle from coach feedback; Phase 2 (reporting) and Phase 3 (dashboard) planned.

## 2) Core Architecture
- Entry point: `run_k.py`
  - `ingest` -> `scripts/run_ingest.py` (`IngestionRobot`)
  - `reprocess` -> `projectk_core/logic/reprocessor.py` (`ReprocessingEngine`)
  - `audit` -> DB quality checks
- Main codebase: `projectk_core/`
  - `processing/` FIT parsing, plan parsing, interval matching, metrics calculation
  - `logic/` classifier, interval detector, profile manager, reprocessor orchestration
  - `db/` Supabase connector + writer
  - `integrations/` Nolio API, storage, weather
- Storage/DB: Supabase (service role key required for backend ops)
- Frontend: Retool reads Supabase views directly (`view_intervals_karo`, `view_weekly_monitoring`, `view_live_flux`, `view_health_radar`)

## 3) Pipeline Ground Truth
- High-level flow:
  1. Nolio activity data + FIT files
  2. `UniversalParser.parse()` -> streams + device metadata + laps
  3. Plan source priority: `NolioPlanParser` (structured JSON) then `TextPlanParser` fallback
  4. Work type classification (`endurance|intervals|competition`)
  5. Metrics + interval detection/matching
  6. Persist into Supabase (`activities`, `activity_intervals`, related views)
- Reprocessing supports file-based recalculation from storage; can operate offline in code path but CLI currently instantiates default mode.

## 4) Data & Metric Conventions
- Speed internal unit: m/s
- Pace display unit: min/km
- Distance: meters; duration: seconds; HR: bpm
- Time normalization: UTC
- Rule: distance-weighted pace (`total_time / total_distance`) over arithmetic speed mean when appropriate
- Constraint: avoid DataFrame row loops; prefer vectorized Pandas/NumPy

## 5) Known Critical Constraints
- Nolio API quotas are strict: 500 calls/hour, 5000/day.
- OAuth refresh flow centralized; tokens persisted in Supabase `app_secrets` and `.env`.
- If refresh token invalid: manual bootstrap via `scripts/auth_nolio_manual.py`.
- `conductor/` is deprecated and should be ignored for active implementation choices.
- `scripts/` contains active + one-shot scripts; do not delete casually.

## 6) Recent Bugfix Memory (from prior context)
- Interval LAP speed bug fixed: LAP `avg_speed` now preferred (`enhanced_avg_speed` / `avg_speed`) over stream recomputation in interval output path.
- Pace aggregation bug fixed: distance-weighted logic applied for interval mean pace where relevant.
- Architecture clarification: in production path, interval pace summary fields are computed in `logic/interval_detector.py` (`_adapt_output`), not only `processing/calculator.py`.

## 7) Current Reliability Risks (from feedback)
- Multi-block sessions (e.g., `5x1km + 9km tempo`) partially detected.
- Some short distance-based interval sets are fully missed.
- Brick sessions may lose one leg (bike/run linking issue).
- Home trainer durability/Q4 may be incorrect if speed-based logic leaks into indoor context.
- Last interval metrics may include recovery/cooldown tails in some sessions.
- Power parity vs Nolio still inconsistent on selected activities.

## 8) Working Rules for Future Changes
- Nolio values/screenshots are treated as source of truth for parity checks.
- Prefer minimal API calls and offline/reprocessing workflows when possible.
- Preserve backward compatibility of Supabase views consumed by Retool.
- Validate fixes with targeted tests and representative sessions (coach-provided cases).

## 9) User-Validated Decisions (2026-02-11)
- Memory reference is confirmed: this file is the active Codex project memory.
- Priority is not pre-assigned; implementation order will be decided pragmatically from impact/risk.
- Complex multi-block sessions are intentionally out-of-scope for now ("botte en touche").
- Brick sessions must be represented as two linked technical activities (bike + run).
- Nolio is absolute SOT for comparisons and arbitration.
- `last_interval` must represent the last interval actually performed by the athlete.
- Interval metrics must be computed on intensity segments only, excluding recovery segments.
- Home trainer sessions: durability/decoupling must be power+HR based (never speed-based).
- Q4/durability formula currently used in this project is the official reference unless later edge-case revisions are decided.
- If Nolio plan is absent, fallback signal mode should optimize for closest possible parity to Nolio behavior.
- `run_k.py reprocess` should NOT default to offline mode; offline is quota-saving fallback only.
- For activities without physio profile, the current completion gate (`>= 70%`) is business-validated.

## 10) Explicitly Deferred / Open Items
- Distance/time alignment tolerance for short distance-based intervals is not fixed yet.
- Method to set tolerance: run targeted tests against explicit Nolio SOT cases provided by user; do not infer SOT.
- Feedback remediation campaign from `feedback_analysis.md` will be handled in another thread.
- Phase 2 delivery plan/spec remains intentionally editable for now.
- Nutrition parsing scope (Phase 3) is postponed.
