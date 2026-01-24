# Specification: Benchmarking Expérimental - Optimisation Détection Signal (1.5.C)

## Objectif
Créer un environnement de test scientifique ("Sandbox") pour comparer plusieurs stratégies de détection d'intervalles sans laps (Algo Only). L'enjeu est de déterminer quelle approche mathématique offre la meilleure parité avec la vérité terrain sur des profils variés.

## Vérité Terrain (Ground Truth)
Les algorithmes seront évalués sur leur capacité à reproduire ces tours réels :

1.  **Adrien Claeyssen (07/01/2026) - "10x2' Z3/ r 1'"**
    - Structure : 10 répétitions de 120s.
    - Défi : Régularité parfaite, fronts de montée cardio.
2.  **Baptiste Delmas (09/01/2026) - "10x1' + 5x2' + 10' Z2"**
    - Structure : Mixte (60s, 120s, 600s).
    - Défi : Changements de rythmes fréquents et blocs de durées variables.
3.  **Bernard Alexis (17/10/2025) - "5x(1'30/3'30)"**
    - Structure : Blocs de 90s actifs suivis de 210s récup.
    - Défi : Récupérations longues qui "polluent" le signal de base.
4.  **Dries Matthys (17/01/2026) - "2x9km Tempo"**
    - Structure : 2 blocs massifs de ~33 minutes.
    - Défi : Détection de blocs longs où le signal peut dériver lentement.

## Stratégies à Tester
L'outil devra permettre de benchmarker les approches classiques ET les innovations de l'agent :
- **Baseline :** K-Means global (actuel - *Échec constaté*).
- **Stratégie A (Local Change Point) :** Détection de rupture (variance/gradient).
- **Stratégie B (Adaptive Thresholding) :** Seuillage dynamique.
- **Stratégie C (Plan-Informed Search) :** Noyau de recherche basé sur le plan.
- **🚀 STRATÉGIE "ULTRA" (LIBRE) :** L'agent a **carte blanche totale**. Il DOIT générer une approche supérieure, possiblement hybride (ex: FFT + Wavelets + Heuristiques physiologiques). 

**ATTENTION :** La précision chirurgicale de Project K repose sur cette détection. L'échec n'est pas une option. La performance de cette stratégie est une question de vie ou de mort pour la crédibilité scientifique du système. L'agent doit faire preuve d'une ingéniosité absolue pour surpasser les laps manuels.

## Mandat de Précision Absolue (Zéro Concession)
L'implémentation ne sera considérée comme terminée QUE lorsque la détection des blocs de haute intensité (Active) sera **quasi-parfaite**. 
- Aucune tolérance pour les décalages de début/fin supérieurs à 2 secondes sur les efforts courts.
- L'erreur sur la fréquence cardiaque moyenne de l'intervalle doit tendre vers zéro (< 0.5 bpm d'écart type).
- Le moteur doit être capable d'isoler le "plateau" de puissance/vitesse sans inclure les phases de transition (sauf si spécifié).

## Critères de Succès
- [ ] Script `scripts/benchmark_algo_strategies.py` fonctionnel.
- [ ] **Zéro Faux Positif :** Le nombre d'intervalles doit être exact à 100%.
- [ ] **Précision Temporelle Chirurgicale :** < 2s d'erreur moyenne sur les départs/fins des blocs "Active".
- [ ] **Stabilité Physiologique :** Écart moyen FC < 1 bpm par rapport à la vérité terrain.
- [ ] **Supériorité Démontrée :** La stratégie choisie doit battre systématiquement le K-Means sur les 4 dossiers tests.
