# Implementation Plan - Track: Smart Segmentation & Multi-Phase Analysis

## Phase 1: Database & Model Preparation
- [x] Task: Create a DB migration to store the new segmented metrics. 5c3e5df
    - [x] Option: Add a `segmented_metrics` JSONB column to the `activity_metrics` table.
- [x] Task: Update `ActivityMetrics` Pydantic model in `projectk_core/logic/models.py`. 0a7e0cb
    - [x] Define `SegmentData` sub-model (hr, speed, power, ratio, torque).
    - [x] Define `SegmentationOutput` model (splits_2, splits_4, manual).
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Nolio Metadata & Classification Logic
- [ ] Task: Implement `ActivityClassifier` in `projectk_core/logic/classifier.py`.
    - [ ] Add logic to detect "Competition" vs "Training" vs "Intervals".
    - [ ] Implement Regex to parse the `#split:` tag from Nolio comments.
- [ ] Task: Create unit tests for the classifier.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Slicing & Calculation Engine
- [ ] Task: Implement `SegmentCalculator` in `projectk_core/processing/segmentation.py`.
    - [ ] Create a generic slicer that takes a DataFrame and a list of start/end points (time or distance).
    - [ ] Implement calculation logic for Run (Speed ratio) vs Bike (Power/Torque ratio).
- [ ] Task: Integrate `SegmentCalculator` into the `MetricsCalculator`.
- [ ] Task: Write comprehensive unit tests for segmentation.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Integration & Validation
- [ ] Task: Update the ingestion pipeline (`run_ingest.py`) to trigger segmentation analysis.
- [ ] Task: End-to-end test with a real `.fit` file (e.g., `allure_semi.fit`) marked as a Competition.
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
