# Project Tracks - Project K

This file tracks the master plan, strictly aligned with the contract phases.

---

# 🏭 PHASE 1 : L'Industrialisation Logistique (COMPLETED)
**Objectif :** Transformer le "bricolage de scripts" en "Usine à Données".
**Livrable Final :** `run_k.py` fonctionnel pour l'analyse automatisée.

## [x] Track 1.1: Database & Athlete Registry (Module C & D)
*Archived in conductor/archive/db_setup_20260111/*
- **Module C (La Mémoire) :** Setup Supabase, Tables `athletes`, `physio_profiles`, `activities`.
- **Module D (Le Bridge) :** Connecteur Python-DB sécurisé, gestion des secrets `.env`.
- **Livrable :** Base de données initialisée et peuplée avec les 53 athlètes et leurs profils historiques.
- **Update (13/01/2026) :** Sécurisation RLS (Row Level Security) activée sur toutes les tables (Service Role Only).

## [x] Track 1.2: The Processing Engine "Le Cerveau" (Module A)
*Core Logic Implementation - The "Intelligence"*
- **Refactoring OOP :** Création des classes `Activity` et `Athlete`.
- **Parser FIT Universel :** Lecture robuste des fichiers `.fit` (Garmin/Wahoo/Zwift).
- **Moteur de Calcul (Vectorisé) :**
    - Normalized Power (NP).
    - Charge (TSS/Load).
    - Découplage (Aerobic Decoupling) & Durabilité.
- **Validation :** Tests unitaires sur fichier sample pour garantir la précision mathématique.
- **Livrable :** Une librairie Python `projectk-core` capable d'ingérer un fichier binaire et de sortir un objet JSON de métriques validées.

## [x] Track 1.3: Ingestion Pipeline & Nolio Sync (Module B)
*Archived in conductor/archive/phase1_moduleB_20260116/*
- **Client API Nolio :** Authentification et récupération automatique des séances.
- **Stockage Cloud :** Sauvegarde des `.fit` bruts dans Supabase Storage.
- **Unicité :** Système de Hash global pour éviter les doublons.
- **Mapping Hardware :** Attribution automatique via Serial Number (Montre -> Athlète).
- **Livrable :** Script qui "écoute" Nolio et remplit la base automatiquement.

## [x] Track 1.4: The Master Script & Delivery (Integration)
*Archived in conductor/archive/phase1_track1_4_20260116/*
- **Link:** [./archive/phase1_track1_4_20260116/plan.md](./archive/phase1_track1_4_20260116/plan.md)
- **Script Maître `run_k.py` :** Orchestration (Ingestion -> Traitement -> Stockage).
- **Migration Historique :** Import des archives passées de Karoly.
- **Gestion Timezones :** Normalisation UTC complète.
- **Livrable Final Phase 1 :** Déploiement et recette avec Karoly.

---

# 🧠 PHASE 2 : Analyse & Reporting (LOCKED)
**Objectif :** Nettoyage scientifique, Détection de Dérive, Rapports PDF.
*Démarre uniquement après validation de la Phase 1.*

## [ ] Track 2.1: Advanced Signal Processing (WP2.1)
- Filtres Scipy (Savitzky-Golay) pour lissage HR.
- Algorithme de détection de Dérive (Drift > 5%).

## [ ] Track 2.2: PDF Reporting Engine (WP2.2)
- Génération HTML/CSS -> PDF.
- Graphiques Matplotlib intégrés.
- Encarts "Alerte Coach".

- Parsing simple des commentaires Nolio (Regex).
- Affichage "Glucides/h".

---



- [x] **Track: Smart Segmentation & Multi-Phase Analysis**
    - **Status:** 🟢 Completed. Multi-phase (2/4) and manual splits (#split) implemented & integrated in ingestion pipeline.
    - **Link:** [./tracks/smart_segmentation_20260115/](./tracks/smart_segmentation_20260115/)

- [x] **Track: Interval Engine & Workout Classification**
    - **Status:** 🟢 Completed & Validated. Robust plan linking, surgical detection (10x2'), and automatic work_type classification.
    - **Link:** [./tracks/interval_classification_20260119/](./tracks/interval_classification_20260119/)

---

- [x] **Track: Sport Classification & Source Mapping Fix**
    - **Status:** 🟢 Completed. Added `source_sport` column, fixed mapping priorities (Bike/Strength first), and updated Nolio API calls to support Coach Mode (athlete_id requirement).
    - **Link:** [./tracks/sport_classification_fix_20260121/](./tracks/sport_classification_fix_20260121/)

---

# 🧠 PHASE 2 : Analyse & Reporting (LOCKED)

---

- [x] **Track: Étendre les capacités d'ingestion de Project K pour supporter les fichiers .tcx et .gz**
    - **Status:** 🟢 Completed & Archived. Implemented `TcxParser`, `UniversalParser`, and GZIP support. Validated with real data.
*Link: [./archive/tcx_support_20260124/](./archive/tcx_support_20260124/)*

---

- [x] **Track: Interval Detection Engine Refactoring (Track 1.5)**
    - **Status:** 🟢 Completed. Robust hybrid engine (Plan/Lap/Algo) with precision metrics (Pa:Hr, Drift). Validated on real data.
    - **Link:** [./archive/interval_detection_20260124/](./archive/interval_detection_20260124/)

- [x] **Track: Audit de Précision Chirurgicale - Détection par Laps (1.5.A)**
*Archived in conductor/archive/audit_laps_20260124/*


---

- [x] **Track: Audit de Robustesse - Détection par Signal Pur (1.5.B)**
*Link: [./archive/algo_robustness_20260124/](./archive/algo_robustness_20260124/)*

---

- [x] **Track: Benchmarking Expérimental - Optimisation Détection Signal (1.5.C)**
*Archived in conductor/archive/algo_benchmarking_20260124/*

---

- [x] **Track: Détection Chirurgicale Ultra-Precision (1.5.D)**
*Archived in conductor/archive/surgical_precision_20260124/*

--- 

- [x] **Track: Méta-Précision - Physique des Capteurs (1.5.E)**
*Archived in conductor/archive/meta_precision_20260124/*

---

- [x] **Track: Optimisation de la bascule (Shift) Lap vs Signal**
*Archived in conductor/archive/shift_logic_stabilization_20260127/*
    - **Status:** 🟢 Completed & Validated. Implemented "Distance Matching" (±5% tolerance) and "Smart Aggregation" (Lap Merging) to prioritize Laps over Signal when distance targets are met. Fixed specific bug with Louis Richard's 7x2km session.

---

- [x] **Track: Fix average power calculation for short neuromuscular sprints (<15s)**
*Archived in conductor/archive/sprint_power_fix_20260127/*

---

- [x] **Track: Fix Classification Over-Sensitivity (Auto-Laps)**
*Link: [./tracks/fix_classification_20260127/](./tracks/fix_classification_20260127/)*
    - **Status:** 🟢 Completed & Validated. Implemented Strategy A (Strict Plan Priority) and Strategy B (Intelligent Lap Filtering for 1km/5km laps). Reprocessed target sessions in production.
