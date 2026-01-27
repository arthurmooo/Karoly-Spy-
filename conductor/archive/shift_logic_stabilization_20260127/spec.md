# Track Specification: Fix Lap vs Signal Shift Instability

## 1. Overview
**Mission:** Stabilize the logic that decides between using "File Laps" (manual/watch splits) and "Signal Detection" (algorithmic) for interval segmentation.
**Problem:** The system currently "shifts" to Signal mode too aggressively, discarding perfectly valid Laps that match the Nolio plan.
**Root Cause Hypothesis:**
1.  **Instability:** Weak decision logic favoring Signal.
2.  **Cumulative Drift:** The system likely searches for laps using absolute planned timestamps. On a long session (e.g., 7x2km), small duration differences accumulate, pushing later laps out of the fixed search window, causing a fallback to Signal.
**Target Case:** Athlete Louis Richard, Session "7x2km Z2 / r=500m" (Jan 27, 2026).

## 2. Functional Requirements

### 2.1 Debugging Infrastructure (Smart Offline Capture)
-   **Action:** Create a script to fetch specific session data (Louis Richard, Jan 27).
-   **Storage:** Save BOTH:
    -   The raw `.FIT` file.
    -   The full JSON response from Nolio (containing the specific Plan structure).
-   **Condition:** Only fetch from API if files do not already exist locally (`data/samples/debug_louis_...`).
-   **Usage:** All development/testing relies on these local files.

### 2.2 Core Logic: Plan-Master Strategy & Smart Matching
-   **Principle:** If the File Laps (or a logical aggregation of them) match the Nolio Planned Structure, the system **MUST** prioritize Laps over Signal.
-   **Smart Aggregation:** The logic must handle split laps (e.g., "1km Recup" + "2km Recup" laps = "3km Recup" plan).
-   **Drift-Resistant Matching (Crucial):**
    -   Abandon fixed absolute time windows for looking up laps.
    -   Implement **Relative Matching**: Match laps based on *sequence* and *duration/distance* relative to the *previous* matched lap, not the session start time.
    -   Allow the "Time Cursor" to float based on the athlete's actual execution speed.

### 2.3 Tolerance Thresholds (Hybrid Model)
-   **Work Intervals:** Strict tolerance (< 5% error in Duration or Distance).
-   **Recovery/Warmup/Cool-down:** Loose tolerance (< 20% error).
-   **Tuning:** Parameters calibrated for the Louis Richard reference case.

## 3. Non-Functional Requirements
-   **API Safety:** Zero unnecessary API calls.
-   **Performance:** Logic enhancement must not significantly slow down the `IntervalEngine`.

## 4. Acceptance Criteria
1.  **Test Case Pass:** The Louis Richard (Jan 27) session is processed **offline** and results in `source: 'laps'` (or equivalent) for its intervals.
2.  **Drift Verification:** The 7th interval (where drift is highest) is correctly identified as a Lap match.
3.  **Accuracy:** The resulting pace and HR matches the "Capture d'écran" values better than the current Signal output.
