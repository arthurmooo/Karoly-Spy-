# Technology Stack: Project K

## Backend & Intelligence Engine
- **Language:** Python 3.x
- **Data Processing:**
    - `pandas`: For vectorized data manipulation (Strictly no `for` loops on DataFrames).
    - `numpy`: For high-performance numerical operations.
    - `scipy.signal`: For signal processing and noise filtering (HR/Power smoothing).
- **File Parsing:**
    - `fitparse`: For extracting raw data from Garmin/Wahoo .FIT files. Configured to extract extended metrics: Grade (derived from Altitude/Distance), Cadence, and Stryd Power. Device temperature is extracted but used only as a fallback to Weather API data.
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
