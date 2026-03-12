# Feedback Analysis Report: Retour application.pdf

## Overview
This document analyzes the feedback provided by Karoly regarding the application's data processing accuracy compared to Nolio (the source of truth).

## 1. Missing Intervals / Structure Issues

### Baptiste Delmas - 21Km : 5*1Km seuil + 9Km Tempo
**Date:** Sat 07 Feb 2026
**Issue:** The application detects the "5x1Km threshold" part but misses the "9Km Tempo" part entirely.
**Nolio Truth:**
- Part 1: 5 x 1km (Threshold)
- Part 2: 9km (Tempo)
**App Found:**
- Only 5x1km detected.
**Action Item:** Investigate "Complex Session" detection logic. The `matcher` might be stopping after the first structured set. A "Multi-Block" logic update is likely needed.

### Laurent Lemonnier - 20*1'30'' Z2/ r 45''
**Date:** Wed 28 Jan 2026
**Issue:** User flagged this session as missing or incomplete.
**Nolio Truth:**
- 20 Repetitions of 1'30" Z2 with 45" rest.
- **Avg Pace:** 3'36/km.
- **Last Pace:** 3'33/km.
**App Found:**
- **Avg Pace:** 3'33/km.
- **Last Pace:** 3'31/km.
**Action Item:** Pace is accurate (3'33 vs 3'36). The main issue is likely the **Count** (Partial Detection) or a visualization issue where repeats are grouped.

### Sylvain Harmand - 20*500m Z2/ r 150m
**Date:** Sat 07 Feb 2026
**Issue:** Completely missing intervals. User states the session is "clean" and should be detected.
**Nolio Truth:**
- 20 x 500m Z2 / 150m rest.
**App Found:**
- No intervals detected.
**Action Item:** Investigate "Distance-based" short intervals. The matcher might be failing to align distance-based targets with actual data if GPS distance is slightly off or if "Smart Aggregation" fails.

### Lucas Hzg - Brick Session (Enchaînement)
**Date:** Thu 05 Feb 2026
**Issue:** For brick sessions (Bike + Run), the application only retrieves the Run part. The Bike session is missing.
**Nolio Truth:**
- Session A: Bike
- Session B: Run (Linked)
**App Found:**
- Only Run session.
**Action Item:** Check ingestion logic (`run_ingest.py`). Are we handling "Linked Sessions" or separate activities on the same day correctly?

## 2. Data Accuracy & Calculation Discrepancies

### Lucas Hzg - 15*2' Z2/ r 1' (Home Trainer)
**Date:** Mon 02 Feb 2026
**Issue:** "How is Q4 calculated?" (Value 1.89 is aberrant).
**Nolio Truth:**
- 15 x 2' Z2 / 1' rest.
**App Found:**
- Q4 (Durability Index) = 1.89 (Implying huge drift).
**Action Item:** Investigate `dur_index` for Home Trainer sessions. Is it using "Speed" (which is often 0 or flat on HT without Zwift) vs HR? For HT, we must force Power-based decoupling.


### Louis Richard - ENC Tempo Full Vélo - 90Km Tempo
**Date:** Sat 07 Feb 2026
**Issue:** "Average power and Last Lap power statistics do not correspond."
**Nolio Truth:**
- Screenshot shows specific power values (though OCR might be fragmented).
**App Found:**
- Values differ from Nolio's summary.
**Action Item:** Verify weighted average power vs. pure average power calculations in `calculator.py`.

### Thierry Legagnoux - Home Trainer
**Date:** Tue 03 Feb 2026
**Issue:** "Average power and Last Lap power statistics do not correspond." (Note: HR is correct).
**Nolio Truth:**
- Specific Power values in summary.
**App Found:**
- Power statistics differ.
**Action Item:** Home Trainer Power might be impacted by how we handle "Zero Power" (e.g., stops, calibration). Verify mean power calculation and last lap extraction logic in `calculator.py`.

### Tanguy Tirel - 14*1Km Z2/ r 250m
**Date:** Thu 29 Jan 2026
**Issue:** Slight Pace discrepancy. App is faster than Nolio.
**Nolio Truth:**
- **Avg Pace:** 3'28/km.
- **Last Pace:** 3'26/km.
**App Found:**
- **Avg Pace:** 3'26/km. (App faster by ~2s)
- **Last Pace:** 3'24/km.
**Action Item:** Acceptable margin of error (GPS smoothing difference?), but monitor if systematic.

### Gilles Bernard - 15*2' Z2/ r 1'
**Date:** Sat 31 Jan 2026
**Issue:** Significant Pace discrepancy. App is slower.
**Nolio Truth:**
- **Avg Pace:** 4'00/km (User wrote 3'60).
- **Last Pace:** 3'58/km.
**App Found:**
- **Avg Pace:** 4'06/km. (+6s error)
- **Last Pace:** 4'08/km. (+10s error)
**Action Item:** Check if we are including "start/stop" inertia or using Elapsed time instead of Moving time for the interval average.

### Robin Lemercier - 15*1' Z2/ r 1'
**Date:** Wed 04 Feb 2026
**Issue:** Major Pace discrepancy. App is significantly slower.
**Nolio Truth:**
- **Avg Pace:** 3'22/km.
- **Last Pace:** 3'15/km.
**App Found:**
- **Avg Pace:** 3'34/km. (+12s error)
- **Last Pace:** 3'28/km. (+13s error)
**Action Item:** Previous report said "No stats", but data exists. The +12s gap suggests we might be including part of the REST period in the active interval average, or failing to trim the "ramp up" phase.

### Steven Galibert - 5*1Km seuil + 9Km Tempo
**Date:** Sat 07 Feb 2026
**Issue:** "Last Pace" discrepancy.
**Nolio Truth:**
- **Avg Pace:** 3'02/km.
- **Last Pace:** 3'02/km. (Note: User input mentioned "20 reps" context which contradicts title, assuming Pace values are correct for this session).
**App Found:**
- **Avg Pace:** 3'04/km. (Close)
- **Last Pace:** 3'16/km. (Significantly slower)
**Action Item:** The "Last Interval" detection seems to be catching the recovery or a "cooldown" tail. If this is a complex session (5x1km + 9km), the "Last Interval" might be mistakenly identifying the 9km block or a transition as the last interval of the set.

## 3. Workflow & UX Questions

### Lucas Hzg - Re-analysis
**Question:** "When an athlete moves a session but doesn't indicate it in the app, is it possible to relaunch the analysis?"
**Context:** Plan vs. Actual date mismatch prevents automatic matching?
**Action Item:** Feature Request: "Force Re-ingest/Re-analyze" button in the UI for a specific athlete/date range.

### Victor Soler - Comparison
**Question:** "How to compare the session of 22/01 with that of 01/02?"
**Context:** User wants to compare progress between identical sessions.
**Action Item:** Feature Request: "Session Comparison View" or "Trend Analysis" for specific session types.

## 4. Logical / Metric Questions

### Lucas Hzg - 15*2' Z2/ r 1' (Home Trainer)
**Question:** "How is Q4 calculated on this kind of session?" (Aberrant value 1.89)
**Context:** Q4 (Durability Index) calculation on Home Trainer seems broken (likely using Speed=0).
**Action Item:** Force Power-based calculation for Home Trainer.

## 5. General Observation (from Audio)
Karoly emphasizes that Nolio screenshots are the **absolute truth**. Any deviation in our graphs/tables compared to these screenshots is a defect to be fixed. He specifically mentions Interval issues.
