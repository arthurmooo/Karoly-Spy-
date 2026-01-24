# Specification: Interval Detection Engine Refactoring (Track 1.5)

## Overview
Ce track vise à transformer la détection d'intervalles actuelle en un système de haute précision capable de segmenter les séances complexes avec une fiabilité absolue. Le moteur doit fusionner les données théoriques (plan Nolio), les actions utilisateur (laps) et l'analyse de signal (algorithmique) pour extraire des métriques physiologiques précises (Pa:Hr, Vitesse:Hr, Dérive) sur chaque bloc d'effort.

## Functional Requirements

### 1. Fusion de Détection "Ensemble" (Triangulation)
- Le moteur doit croiser trois sources de vérité :
    - **Priorité 1 (Théorie) :** Corrélation avec la structure prévue dans le plan Nolio.
    - **Priorité 2 (Utilisateur) :** Analyse des laps (tours) manuels/automatiques enregistrés par l'appareil.
    - **Priorité 3 (Algorithme) :** Analyse de rupture de signal (Vitesse/Puissance) pour affiner les points de bascule.
- Calcul d'un score de confiance pour chaque intervalle détecté.

### 2. Segmentation et Ajustement Dynamique
- **Ajustement Élastique :** Capacité à détecter si un athlète effectue moins de répétitions que prévu et à tronquer le plan en conséquence sans décaler les blocs suivants.
- **Gestion des Blocs Complexes :** Support des structures imbriquées (ex: 3 x (1km @10k + 2km @Semi)).
- **Nettoyage des Laps :** Filtrage intelligent des laps parasites (erreurs de manipulation, laps trop courts).

### 3. Métriques Physiologiques par Intervalle
- **Indicateurs de base :** Vitesse/Puissance moyenne, FC moyenne, Cadence moyenne.
- **Efficacité & Dérive :**
    - Calcul du ratio Pa:Hr (vélo) ou Vitesse:Hr (course) sur la **moyenne** de l'intervalle.
    - Calcul du ratio sur la **dernière répétition** du bloc pour mesurer la dérive sous fatigue.
    - **Intégration Totale :** Prise en compte de la FC dès le début de l'intervalle (pas de filtre de stabilisation) pour capturer l'intégrale de l'effort.

### 4. Audit et Sorties
- **Table SQL `activity_intervals` :** Stockage d'une ligne par intervalle avec métriques complètes.
- **Audit Log :** Documentation technique de la logique de détection pour chaque bloc (pourquoi ce point de départ/fin ?).
- **Interface JSON :** Export structuré pour les dashboards de Karoly.

## Non-Functional Requirements
- **Précision Temporelle :** Alignement des blocs à la seconde près.
- **Robustesse :** Tolérance aux signaux GPS dégradés ou aux arrêts capteurs.
- **Performance :** Traitement vectorisé (Pandas) pour éviter les boucles lentes.

## Acceptance Criteria
- [ ] Le moteur identifie correctement 100% des intervalles sur une séance de test "propre".
- [ ] Le moteur ajuste la structure si l'athlète saute une répétition (vérifié par test unitaire).
- [ ] Les métriques d'efficacité Pa:Hr et Vitesse:Hr correspondent aux calculs manuels de Karoly (Audit de parité).
- [ ] Les séances complexes (blocs mixtes) sont segmentées conformément au plan Nolio.

## Out of Scope
- Création de l'interface graphique finale (dashboard).
- Analyse des séances de natation.