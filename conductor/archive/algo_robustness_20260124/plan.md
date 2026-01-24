# Implementation Plan - Track 1.5.B: Audit de Robustesse (Signal Pur)

Ce plan suit une approche TDD pour valider l'intelligence du moteur de segmentation sans l'aide des laps de la montre.

## Phase 1: Infrastructure d'Audit & Mock Data
L'objectif est de préparer les données de référence et l'outil de comparaison.

- [ ] **Task: Setup Ground Truth Data**
    - [ ] Créer un fichier `data/test_cache/audit_ground_truth.json` contenant les tours réels (Nolio) fournis pour les 4 athlètes.
- [ ] **Task: Create Audit Script Foundation**
    - [ ] Créer `scripts/audit_algo_robustness.py`.
    - [ ] Implémenter le chargement des activités depuis Supabase ou le cache local.
    - [ ] Injecter une option pour forcer `raw_laps = None` dans le `IntervalEngine`.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)**

## Phase 2: Exécution & Comparaison Mathématique
Calcul des dérives entre la détection algorithmique et la réalité.

- [ ] **Task: Implement Comparison Logic**
    - [ ] Développer une fonction de "Matching" qui associe chaque bloc détecté par l'algo au tour intense le plus proche dans le Ground Truth.
    - [ ] Calculer les deltas : `diff_duration`, `diff_hr`, `diff_distance`, `diff_speed`.
- [ ] **Task: Write Tests for Detection Parity**
    - [ ] Créer `tests/test_audit_engine.py`.
    - [ ] Vérifier que pour la séance de Dries (2x9km), l'algo trouve exactement 2 blocs intenses en mode "Algo Only".
- [ ] **Task: Run Full Audit Suite**
    - [ ] Exécuter le script sur les 4 séances cibles.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)**

## Phase 3: Analyse de Robustesse & Rapport Final
Identification des limites et documentation.

- [ ] **Task: Identify Edge Cases & Refine (if needed)**
    - [ ] Analyser les écarts et ajuster les paramètres `merge_gap` ou `min_duration` si nécessaire.
- [ ] **Task: Generate Final Report with Detailed Tables**
    - [ ] Produire `audit_algo_report.md` avec les tableaux comparatifs **Nolio vs Algo** tour par tour pour les 4 athlètes (Distance, Durée, HR, Vitesse).
- [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
