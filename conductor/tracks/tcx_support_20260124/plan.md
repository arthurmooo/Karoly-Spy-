# Implementation Plan: TCX and GZIP Support (tcx_support_20260124)

## Phase 1: Foundation & TCX Parsing
- [x] **Task: Create TCX Parser module** 47b4daa
    - [ ] Create `projectk_core/processing/tcx_parser.py` with `TcxParser` skeleton.
    - [ ] Write unit tests in `tests/test_tcx_parser.py` using a mock TCX structure (Red Phase).
    - [ ] Implement `TcxParser` using `xml.etree.ElementTree` to extract metrics (Green Phase).
    - [ ] Verify Data Parity: Ensure DataFrame columns and types match `FitParser` exactly.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Foundation & TCX Parsing' (Protocol in workflow.md)**

## Phase 2: Universal Parsing & GZIP Support
- [ ] **Task: Implement Universal Dispatcher & GZIP handling**
    - [ ] Create or update `projectk_core/processing/parser.py` to include a `UniversalParser` class.
    - [ ] Write tests in `tests/test_universal_parser.py` for file type detection (FIT vs TCX vs GZ) (Red Phase).
    - [ ] Implement in-memory GZIP decompression (Green Phase).
    - [ ] Implement routing logic to delegate to `FitParser` or `TcxParser` (Green Phase).
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Universal Parsing & GZIP Support' (Protocol in workflow.md)**

## Phase 3: Integration & Validation
- [ ] **Task: Create validation script and verify with real data**
    - [ ] Create `scripts/validate_tcx_support.py`.
    - [ ] Test the full pipeline with Matthieu Poullain's sample files (if available in `data/samples/`).
    - [ ] Verify average Heart Rate and Power match Nolio reference values.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Integration & Validation' (Protocol in workflow.md)**
