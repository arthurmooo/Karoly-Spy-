# Implementation Plan: Bulletproof Interval Detection & Calculation Engine

## Phase 1: Audit de Précision et Parité Nolio
Objectif : Atteindre une parité parfaite avec Nolio sur les calculs de base.

- [x] Task: Analyse de l'écart de calcul (Moving vs Elapsed) 9718d04
    - [x] Créer `scripts/audit_lap_precision.py` pour comparer les laps .FIT locaux aux données Nolio.
    - [x] Cibler en priorité les séances de Baptiste Delmas (08/01/2026).
- [x] Task: Harmonisation du moteur de calcul "Parity Match" 9718d04
    - [x] Écrire les tests unitaires dans `tests/test_interval_parity.py`.
    - [x] Mettre à jour `projectk_core/processing/lap_calculator.py` pour garantir la précision.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) 9718d04

## Phase 2: Moteur de Détection "Signal-Based" (Lap-proof)
Objectif : Détecter les intervalles via le signal et les recaler sur la structure prévue.

- [~] Task: Implémentation de la Step Detection (Analyse de signal)
    - [ ] Développer l'algorithme de détection de rupture sur le signal brut dans `projectk_core/logic/step_detector.py`.
    - [ ] Tester sur la séance de Bernard Alexis (17/10/2025).
- [ ] Task: Algorithme de "Best Match" & Recalage Structure
    - [ ] Améliorer le `IntervalMatcher` pour corréler les segments avec le "Planned Workout" (via cache).
    - [ ] Valider sur les séances complexes (Vagues d'Edouard Tiret 03/04/2025).
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Optimisation et Validation Finale
Objectif : Sécuriser le flux de production et gérer les échecs.

- [ ] Task: Implémentation du Fallback Temporel et Cache API
    - [ ] Ajouter la logique de fallback (1/2, 1/4) si confiance < 70%.
    - [ ] Optimiser le stockage local des `planned_workout`.
- [ ] Task: Test d'End-to-End "Gold Standard" (Aveugle)
    - [ ] Valider l'ensemble des 5 séances de référence en mode synchro automatique.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
