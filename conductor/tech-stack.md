# Technology Stack: Project K

## Backend & Intelligence Engine
- **Language:** Python 3.x
- **Data Processing:**
    - `pandas`: For vectorized data manipulation (Strictly no `for` loops on DataFrames).
    - `numpy`: For high-performance numerical operations.
    - `scipy`: For advanced signal processing (Savitzky-Golay filtering) and Peak Detection (`scipy.signal.find_peaks`).
- **Signal Processing:** Surgical Interval Alignment using Difference of Means (DoM), Cadence Snap, and Statistical Plateau Validation.
- **File Parsing:**
    - `fitdecode`: For robust extraction of raw data from modern .FIT files (Garmin, Wahoo, Coros).
    - `xml.etree.ElementTree`: For parsing .TCX files (Standard Library).
    - `gzip`: For handling compressed activity files (Standard Library).
- **API Clients:**
    - `supabase`: Official Python client for interacting with Supabase DB and Storage.
    - `requests`: For handling REST API interactions (Nolio).
- **Data Validation:**
    - `pydantic`: For defining robust data models and schemas.

## Data Storage & Infrastructure
- **Platform:** Supabase
- **Database:** PostgreSQL (Managed by Supabase).
- **Blob Storage:** Supabase Storage (For storing raw .FIT files).
- **Authentication:** Supabase Auth (To secure athlete data).

## API & Integration
- **Output:** JSON API (To be consumed by future frontend layers).
- **External Integration:**
    - Nolio API (For initial activity ingestion and metadata like RPE).
    - OpenWeatherMap API (For high-precision historical weather data: Temperature and Humidity at session location).

## Development Standards
- **Architecture:** Object-Oriented Programming (OOP) with modular design.
- **Environment Management:** Python `dotenv` for secure secret handling.
- **Typing:** Strict use of Python type hints for production-grade reliability.
