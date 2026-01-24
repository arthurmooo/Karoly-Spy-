# Implementation Plan - Track 1.5.E: Méta-Précision

> ### 🚀 OPÉRATION : OVERCLOCKING ALGORITHMIQUE
> **MISSION :** Pulvériser la barrière du 1Hz pour atteindre la précision milliseconde.
> **ENJEU :** 1 Milliard de Dollars (virtuels).
> **CONDITION :** Amélioration obligatoire sur TOUS les fichiers tests.

## Phase 1: La Continuité (Sub-1Hz)
- [x] **Task: Implémentation du SplineInterpolator**
    - [x] Développer une couche d'interpolation cubique pour le signal primaire (Power/Speed).
    - [x] Détecter le point d'inflexion exact entre deux secondes.

## Phase 2: La Synchronisation Temporelle
- [x] **Task: Compensateur de Lag Capteurs**
    - [x] Créer une matrice de latence par flux (HR: +2s, Power: +0.5s, GPS: +1s).
    - [x] Recaler les signaux avant l'analyse de gradient pour une fusion multi-signal parfaite.

## Phase 3: L'Ancre de Vérité (Physique)
- [x] **Task: Analyse de l'Impact initial (Jerk)**
    - [x] Si `cadence` est disponible, utiliser son front de montée comme déclencheur prioritaire sur la puissance lissée.
    - [x] Valider l'instant T0 via la cinétique de montée HR.

## Phase 4: Recette & Validation Comparative
- [x] **Task: Le Grand Audit Final**
    - [x] Comparer ULTRA V5 (Actuel) vs GOD MODE (Nouveau).
    - [x] Prouver l'amélioration sur Adrien, Baptiste, Bernard et Dries.
