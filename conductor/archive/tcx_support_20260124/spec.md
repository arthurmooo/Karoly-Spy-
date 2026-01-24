# Specification: TCX and GZIP Support for Activity Ingestion (Track: tcx_support)

## 1. Overview
Project K currently only supports `.fit` files for activity ingestion. Some athletes, like Matthieu Poullain, use `.tcx` (Training Center XML) files, often compressed as `.gz`. This track aims to implement a robust parser for TCX files and integrated GZIP decompression to ensure all athlete data can be processed for physiological analysis (MLS, Load, etc.).

## 2. Functional Requirements
- **TCX Parsing**: Extract 1Hz time-series data from TCX files using `xml.etree.ElementTree`.
- **Metrics Extraction**: Support `Timestamp`, `HeartRateBpm`, `Watts` (Power), `Speed`, `Cadence`, `Distance`, `Altitude`, and `Position` (Lat/Lon).
- **Universal Detection**: Implement a dispatcher (e.g., `UniversalParser`) that detects if a file is FIT, TCX, or GZIP-compressed by reading magic bytes/headers.
- **In-memory Decompression**: Handle `.gz` files transparently in-memory using the standard `gzip` library.

## 3. Non-Functional Requirements
- **Strict Data Parity**: The resulting Pandas DataFrame MUST be **identical** in structure (column names, units, data types, index) to the current `FitParser` output. Downstream logic (e.g., Interval Engine) must be completely agnostic to the source file format.

## 4. Technical Requirements
- **Language**: Python 3.
- **Libraries**: `xml.etree.ElementTree`, `pandas`, `gzip`, `fitparse` (existing).
- **Location**:
    - `projectk_core/processing/tcx_parser.py` (New)
    - `projectk_core/processing/parser.py` (Update or New `UniversalParser`)

## 5. Acceptance Criteria
- [ ] TCX files are correctly parsed into a 1Hz DataFrame.
- [ ] GZIP files (both FIT and TCX) are decompressed and parsed automatically.
- [ ] Heart rate and power metrics from Matthieu Poullain's sample files match Nolio's reference values (e.g., 111 bpm average for identified test session).
- [ ] `scripts/validate_tcx_support.py` runs successfully on sample data.

## 6. Out of Scope
- Support for other formats like .gpx or .pwx.
- Modification of the database schema (assuming current schema supports these metrics).
