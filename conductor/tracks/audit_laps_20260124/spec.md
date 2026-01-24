# Specification: Audit de Précision Chirurgicale - Détection par Laps (1.5.A)

## 1. Overview
Ce track vise à auditer et valider la précision du moteur d'intervalles (`projectk_core/processing/interval_engine.py`) lorsqu'il fonctionne en mode **Lap Detection** (tours enregistrés par la montre). L'objectif est d'atteindre une parité mathématique quasi-totale avec les données extraites de Nolio.

## 2. Functional Requirements
- **Extraction des Tours :** Le script d'audit doit extraire les "Laps" directement des fichiers .fit originaux.
- **Calcul des Métriques par Intervalle :**
    - Durée (Timer Time)
    - Distance (m)
    - FC Moyenne (bpm)
    - Vitesse Moyenne (km/h)
- **Comparaison Automatisée :** Le script doit comparer les résultats calculés avec les données "Ground Truth" fournies par l'utilisateur.
- **Reporting :** Génération d'un tableau Markdown synthétisant les écarts (Deltas) pour chaque tour de chaque séance.

## 3. Ground Truth Data (Source of Truth)
Les données fournies par l'utilisateur (Nolio) sont intégrées comme référence absolue :
- **Dries Mathys (17/01/2026) :** 9 tours (Dist, Temps, Vitesse, FC).
- **Bernard Alexis (17/10/2025) :** 17 tours (Dist, Temps, Vitesse, FC).
- **Baptiste Delmas (09/01/2026) :** 7 tours (Dist, Temps, Vitesse, FC).

## 4. Acceptance Criteria (Success Thresholds)
Un test est considéré comme réussi si les écarts sont inférieurs ou égaux à :
- **Temps :** +/- 1 seconde.
- **Distance :** +/- 10 mètres.
- **FC / Vitesse :** +/- 1 bpm ou 0.1 km/h.

## 5. Out of Scope
- Puissance moyenne pour la course à pied.
- Détection algorithmique (K-Means).
