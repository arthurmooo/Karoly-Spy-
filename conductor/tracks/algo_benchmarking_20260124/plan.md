# Implementation Plan - Track 1.5.C: Benchmarking Expérimental

## Phase 1: Framework de Benchmarking
- [x] **Task: Centraliser le Ground Truth** [be6de8e]
    - [x] S'assurer que `data/test_cache/audit_ground_truth.json` est exhaustif pour les 4 athlètes.
- [ ] **Task: Créer le script de Benchmark**
    - [ ] Développer `scripts/benchmark_algo_strategies.py`.
    - [ ] Implémenter une interface pour tester différentes classes de détection (`AlgoDetectorV1`, `V2`, etc.).

## Phase 2: Implémentation des Candidats (Laboratoire)
- [ ] **Task: Prototype Stratégie A (Rupture/Gradient)**
- [ ] **Task: Prototype Stratégie B (Seuillage Adaptatif)**
- [ ] **Task: Prototype Stratégie C (Plan-Driven Kernel)**
- [ ] **Task: INVENTER la Stratégie "ULTRA" (Gagnante)**
    - [ ] Analyse approfondie des échecs du K-Means sur les 4 fichiers FIT.
    - [ ] Conception d'une logique propriétaire "Anti-Noise" et "High-Fidelity".

## Phase 3: Analyse & Sélection
- [ ] **Task: Run Full Suite & Comparison**
    - [ ] Générer un rapport de performance comparant chaque stratégie sur les 4 séances.
- [ ] **Task: Boucle d'Optimisation Infinie (Jusqu'à la Perfection)**
    - [ ] Analyser les "Corner Cases" (ex: pics de vitesse parasites, dérives cardio lentes).
    - [ ] Ajuster les paramètres jusqu'à atteindre les < 2s d'erreur sur TOUS les fichiers tests.
- [ ] **Task: Sélection & Intégration Finale**
    - [ ] Choisir la stratégie gagnante et l'intégrer proprement dans `projectk_core`.
