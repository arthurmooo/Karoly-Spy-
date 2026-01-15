# Specification: Smart Segmentation & Multi-Phase Analysis

## 1. Overview
L'objectif est d'enrichir l'analyse des activités en découpant automatiquement les séances "Compétition" et "Entraînement" pour monitorer la dérive physiologique via des indicateurs précis sur des segments de 50% (1/2) et 25% (1/4).

## 2. Functional Requirements

### 2.1 Classification & Découpage Automatique
Le système applique le découpage suivant selon le type d'activité :

*   **Compétition** (Détecté via Type Nolio ou Mots-clés : `Course`, `Race`, `10k`, `Semi`, `Marathon`...) :
    *   **Double Découpage OBLIGATOIRE :** Le système calcule **simultanément** les métriques pour un découpage en **2 phases** (50/50) ET en **4 phases** (25/25/25/25).
*   **Entraînement Continu** (Non-Intervalle, Non-Compétition) :
    *   Découpage par défaut en **2 phases** (50/50).

### 2.2 Mode Manuel (Override)
*   Si le coach souhaite analyser des sections spécifiques (ex: exclure échauffement), il ajoute un tag dans Nolio.
*   **Tag:** `#split: start_km-end_km` (ex: `#split: 5-15, 15-25`) ou `#split: start_time-end_time`.
*   Dans ce cas, le système calcule les métriques **uniquement** sur les segments définis manuellement. Le coach délimite lui-même les parties en donnant les timestamps ou la donnée kilométrique.

### 2.3 Métriques Requises (Output)

Pour chaque segment défini (que ce soit 1/2, 1/4 ou manuel), les valeurs suivantes doivent être stockées :

**Pour la Course à Pied (Run/Trail) :**
1.  **HR (Moyenne)**
2.  **Vitesse (Moyenne)**
3.  **Ratio HR / Vitesse** (Efficiency Factor)

**Pour le Vélo (Ride/VirtualRide) :**
1.  **HR (Moyenne)**
2.  **Puissance (Moyenne)** *(Remplace la Vitesse)*
3.  **Ratio HR / Puissance** (Efficiency Factor)
4.  **Torque (Moyenne)** *(Spécifique Vélo)*

## 3. Technical Requirements
- **Vectorisation :** Utiliser Pandas pour calculer ces moyennes sur les plages d'index (slicing) sans boucles for (performance).
- **Adaptabilité :** Le code doit gérer le cas où la puissance ou le torque est manquant (valeur `null`).

## 4. Acceptance Criteria
- [ ] Une activité "Compétition" produit automatiquement les jeux de données "2 phases" et "4 phases".
- [ ] Une activité vélo calcule bien le ratio sur la **Puissance** et inclut le **Torque**.
- [ ] Une activité CàP calcule bien le ratio sur la **Vitesse**.
- [ ] Le mode manuel (tag `#split`) écrase le découpage automatique si présent.
