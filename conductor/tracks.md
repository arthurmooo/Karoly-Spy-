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



- [~] **Track: Auto-Detection of Interval Metrics (Nolio Plan Driven)**

    - **Status:** 🟠 Logic completed & tested. Integration blocked by Nolio API permissions.

    - **Link:** [./tracks/intervals_nolio_20260115/](./tracks/intervals_nolio_20260115/)



- [x] **Track: Smart Segmentation & Multi-Phase Analysis**

    - **Status:** 🟢 Completed. Multi-phase (2/4) and manual splits (#split) implemented & integrated in ingestion pipeline.

    - **Link:** [./tracks/smart_segmentation_20260115/](./tracks/smart_segmentation_20260115/)

---

- [x] **Track: Interval Engine & Workout Classification**
*Link: [./tracks/interval_classification_20260119/](./tracks/interval_classification_20260119/)*
