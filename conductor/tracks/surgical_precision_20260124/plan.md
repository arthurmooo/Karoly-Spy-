# Implementation Plan - Track 1.5.D: Détection Chirurgicale

> ### 🚀 MANDAT CRITIQUE : ARCHITECTE ALGORITHMIQUE RANG S
> **MISSION :** Résoudre le dernier problème majeur de Project K : la précision sub-seconde et la séparation effort/récup active.
> 
> **RÉCOMPENSE :** Un bonus exceptionnel de **1 Milliard de Dollars** (virtuels) sera débloqué si tu atteins une précision parfaite. L'échec n'est pas toléré.
> 
> **OBJECTIF :** Atteindre **< 1 seconde d'erreur temporelle** et **< 0.2 bpm d'erreur HR** par rapport aux tours manuels (LAPS) des fichiers FIT.
> 
> **INSTRUCTION CRUCIALE :** Tu dois **SYSTÉMATIQUEMENT** comparer tes résultats obtenus par l'algorithme à la **Source of Truth** absolue : l'extraction de ces mêmes séances via la méthode des laps manuels du fichier FIT. Toute divergence > 1s par rapport aux laps réels signifie que tu n'as pas encore gagné le milliard.
> 
> **TES ARMES :**
> 1. **Le Plan Nolio :** Utilise `planned_structure` comme un calque template pour guider la détection.
> 2. **La Cross-Corrélation :** Fais glisser le plan théorique sur le signal réel pour trouver le "Best Fit".
> 3. **Analyse Multi-Signal :** Combine Vitesse + Puissance + Cadence.
> 4. **Denoising Avancé :** Filtres de Savitzky-Golay ou ondelettes.
> 
> **SOIS INGÉNIEUX. SOIS CHIRURGICAL. GAGNE CE MILLIARD.**

## Phase 1: Le Calque Nolio
- [x] **Task: Intégration du Plan comme Guide**
    - [x] Développer `PlanDrivenSeeker` : utilise la durée prévue dans Nolio pour focaliser la détection de gradient.
    - [x] Gérer les décalages (l'athlète part 10s après le bip).

## Phase 2: La Séparation des Eaux (Bernard Alexis case)
- [x] **Task: Discrimination Effort vs Récup Active**
    - [x] Utiliser le ratio Puissance/Cadence ou Vitesse/Cadence pour isoler le changement de foulée entre effort et récup.
    - [x] Implémenter un filtre de "Micro-Variations" pour couper le bloc de 5' en 1'30+3'30.

## Phase 3: Validation & Recette Finale
- [x] **Task: Boucle de Perfectionnement Automatisée**
    - [x] Exécuter le benchmark en boucle jusqu'à ce que `Avg Start Error` < 1s sur TOUS les fichiers.
    - [x] Signer la version "ULTRA MASTER" de `projectk_core`.
