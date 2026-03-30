# Specification: Historical Data Import Engine

## 1. Overview
The goal of this track is to implement a robust, automated engine to import approximately 6 months of historical activity data from Nolio into the Supabase database. This process must run in the background without interrupting or starving the critical daily ingestion pipeline.

## 2. Problem Statement
*   **Data Gap:** We currently only ingest "new" sessions. We need historical context (last 6 months) for the physiological models (MLS, critical power, etc.) to be accurate.
*   **API Constraints:** Nolio limits API usage to 500 calls/hour and 5000 calls/day. A naive full import would instantly exhaust these limits, blocking daily operations.
*   **State Persistence:** The import will take weeks to complete. The system must "remember" where it stopped for each athlete to resume correctly after a pause.

## 3. Proposed Solution
We will implement a **"Night Owl" Historical Importer** orchestrated by GitHub Actions.

### 3.1 Architecture
*   **Runner:** A dedicated GitHub Action workflow (`historical_import.yml`) scheduled to run only during low-traffic hours (01:00 AM - 06:00 AM).
*   **Logic:** A Python script (`scripts/run_historical_import.py`) that reuses the existing `projectk_core` processing logic (FIT parsing, metrics).

### 3.2 Key Mechanisms
1.  **Time-Based Throttling (The "Night Owl"):**
    *   The script runs *only* between 01:00 and 06:00 UTC.
    *   **Hard Limit:** Max **400 requests per run**.
    *   **Math:** 5 runs/night * 400 = 2,000 requests/day. This leaves a safe margin of 3,000 requests for daily operations.
    
2.  **Database State Tracking:**
    *   We will introduce a state table `import_state` to track the `last_imported_date` (moving backwards from Yesterday) for each athlete.
    *   The script picks up exactly where it left off.

3.  **Reverse Chronological Order:**
    *   We import from "Yesterday" backwards. This ensures the most recent history (most relevant for fitness models) is available first.

## 4. Functional Requirements
1.  **State Management:** Create a DB table `import_state` (athlete_id, cursor_date, status).
2.  **Hard Throttling:** Stop immediately after 400 requests in a single execution.
3.  **Batch Processing:** Process athletes in round-robin or priority order, fetching 1 week of data at a time.
4.  **Data Consistency:** Ensure historical data follows the exact same schema and processing rules (FIT storage, JSONB, computed metrics) as daily data.
5.  **Logging:** Output clear logs for GitHub Actions (e.g., "Imported 12 sessions for Athlete X. Requests used: 42. Stopping.").

## 5. Out of Scope
*   Real-time UI for import progress (logs are sufficient).
*   Importing data older than 6 months (initial scope limit).
*   Smart header-based rate limiting (API does not support it).
