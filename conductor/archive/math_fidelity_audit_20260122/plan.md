# Implementation Plan: Mathematical Fidelity Audit

This track establishes a parity testing framework to ensure the `projectk_core` logic is 100% aligned with Karoly Spy's original notebook formulas for MLS, EF, and Drift.

## Phase 1: Test Bed Construction & Token-Efficient Data Selection
Focus on setting up the infrastructure while strictly preserving Nolio API quotas.

- [x] Task: Inventory Existing Test Data. Scanner `data/samples/` et `data/test_cache/` pour identifier les fichiers .FIT déjà téléchargés couvrant les profils cibles (Vélo/Pwr, Course/Spd). (e98b7f1)
- [x] Task: Create Parity Test Harness. Développer `scripts/audit_parity.py` capable de fonctionner en mode "Hors-ligne" sur les fichiers locaux. (cf64169)
- [x] Task: Write Parity Unit Tests. Implémenter `tests/test_mathematical_parity.py` avec des mocks pour éviter tout appel réseau accidentel. (cf64169)
- [~] Task: Conductor - User Manual Verification 'Phase 1: Test Bed Construction & Token-Efficient Data Selection' (Protocol in workflow.md)

## Phase 2: MLS (Mixed Load Score) Audit & Alignment
Rigorous verification of the hybrid load model.

- [x] Task: Audit MLS Bins & Factors. Verify intensity distribution and factors match perfectly for both Bike (CP) and Run (CS). (cf64169)
- [x] Task: Audit Alpha/Beta Coefficients. Ensure `alpha_int` (0.50) and `beta_dur` (0.08) are applied exactly as in `TrainingLoad.ipynb`. (cf64169)
- [x] Task: Fix MLS Discrepancies. Corrections dans `projectk_core/logic/calculator.py` pour atteindre <0.1% de déviation. (cf64169)
- [x] Task: Conductor - User Manual Verification 'Phase 2: MLS (Mixed Load Score) Audit & Alignment' (Protocol in workflow.md) (cf64169)

## Phase 3: EF & Drift Audit & Alignment
Rigorous verification of the efficiency and decoupling metrics.

- [x] Task: Audit EF Average Logic. Verify smoothing windows and average calculations. (cf64169)
- [x] Task: Audit Decoupling (Pa:HR) split. Ensure the "two-halves" split logic matches `Calcul_Durability.ipynb`. (cf64169)
- [x] Task: Audit Cleaning Logic. Verify handling of gaps > 10s and outliers. (cf64169)
- [x] Task: Fix EF/Drift Discrepancies. Corrections dans la couche logique. (cf64169)
- [x] Task: Conductor - User Manual Verification 'Phase 3: EF & Drift Audit & Alignment' (Protocol in workflow.md) (cf64169)

## Phase 4: Final Validation & Certification
- [x] Task: Generate Final Parity Report. Run the audit script on the full offline test battery. (cf64169)
- [x] Task: Update Internal Documentation. Documenter les formules validées. (cf64169)
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Validation & Certification' (Protocol in workflow.md) (cf64169)
