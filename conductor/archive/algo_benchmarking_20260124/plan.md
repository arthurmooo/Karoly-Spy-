# Implementation Plan - Track 1.5.C: Benchmarking Expérimental

## Phase 1: Framework de Benchmarking
- [x] **Task: Centraliser le Ground Truth** [be6de8e]
    - [x] S'assurer que `data/test_cache/audit_ground_truth.json` est exhaustif pour les 4 athlètes.
- [x] **Task: Créer le script de Benchmark** [145ee06]
    - [x] Développer `scripts/benchmark_algo_strategies.py`.
    - [x] Implémenter une interface pour tester différentes classes de détection (`AlgoDetectorV1`, `V2`, etc.).

## Phase 2: Implémentation des Candidats (Laboratoire)
- [x] **Task: Prototype Stratégie A (Rupture/Gradient)** [4c9a592]
- [x] **Task: Prototype Stratégie B (Seuillage Adaptatif)** [9be6de8]
- [x] **Task: Prototype Stratégie C (Plan-Driven Kernel)** [7d3a592]
- [x] **Task: INVENTER la Stratégie "ULTRA" (Gagnante)** [be6de8e]
    - [x] Analyse approfondie des échecs du K-Means sur les 4 fichiers FIT.
    - [x] Conception d'une logique propriétaire "Anti-Noise" et "High-Fidelity".

## Phase 3: Analyse & Sélection
- [x] **Task: Run Full Suite & Comparison** [be6de8e]
    - [x] Générer un rapport de performance comparant chaque stratégie sur les 4 séances.
- [x] **Task: Boucle d'Optimisation Infinie (Jusqu'à la Perfection)** [be6de8e]
    - [x] Analyser les "Corner Cases" (ex: pics de vitesse parasites, dérives cardio lentes).
    - [x] Ajuster les paramètres jusqu'à atteindre les < 2s d'erreur sur TOUS les fichiers tests.
- [x] **Task: Sélection & Intégration Finale** [be6de8e]
    - [x] Choisir la stratégie gagnante et l'intégrer proprement dans `projectk_core`.
