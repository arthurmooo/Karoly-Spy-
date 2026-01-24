# Specification: Audit de Robustesse - Détection par Signal Pur (1.5.B)

## Overview
Ce track vise à auditer et valider la performance du détecteur algorithmique (Interval Engine Fallback) en mode "Algo Only" (exclusion totale des laps de la montre). L'objectif est de garantir que le système est capable d'identifier les blocs d'effort intenses avec une précision chirurgicale, même sans l'aide des marqueurs manuels de l'athlète.

## Functional Requirements
1.  **Forçage "Algo Only" :** Créer un outil d'audit capable de désactiver les `raw_laps` et de forcer l'analyse par K-Means et lissage de signal.
2.  **Audit Multi-Athlètes (Nolio Ground Truth) :** Tester l'algorithme sur quatre profils dont les tours réels ont été fournis :
    -   **Adrien Claeyssen (07/01/2026) :** 10x2' (Récups actives).
    -   **Baptiste Delmas (09/01/2026) :** 10x1' + 5x2' + 10' Z2 (Structure mixte).
    -   **Bernard Alexis (17/10/2025) :** 5x(1'30/3'30) (Intervalles classiques).
    -   **Dries Matthys (17/01/2026) :** 2x9km Tempo (Blocs longs).
3.  **Comparaison de Précision :** Générer un rapport automatisé comparant les résultats "Algo" aux tableaux Nolio fournis par l'utilisateur.
4.  **Métriques de Validation (Zéro Concession) :** Pour chaque tour intense identifié, les métriques suivantes doivent être quasi-identiques aux données Nolio :
    -   **Durée :** Précision temporelle (décalage < 3-5s).
    -   **Distance :** Intégrité du calcul de distance sur le segment.
    -   **FC Moyenne :** Stabilité physiologique.
    -   **Vitesse/Allure Moyenne :** Précision de la performance.
5.  **Parité du Compte :** L'algorithme doit détecter le nombre exact de blocs intenses.

## Acceptance Criteria
-   [ ] Script `scripts/audit_algo_robustness.py` fonctionnel.
-   [ ] Tableau comparatif (Nolio vs Algo) généré tour par tour pour les 4 séances.
-   [ ] Écart moyen sur la FC < 2 bpm pour les tours intenses.
-   [ ] Écart moyen sur la durée < 5s par bloc.
-   [ ] Rapport de robustesse `audit_algo_report.md` livré.
