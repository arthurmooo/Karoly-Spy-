# 💡 Backlog d'Améliorations Techniques & Algorithmiques
*Ce fichier collecte les opportunités d'amélioration détectées durant le développement de la Phase 1, à prioriser pour la Phase 2 (Analyse & Reporting).*

## 🧠 Module A: The Processing Engine (Python)

### 1. Configuration Dynamique Avancée
- **Observation :** Les paliers d'Intensité (IF Bins) `((0.75, 0.85), ...)` sont actuellement définis comme constantes (`HARDCODED`) dans `MetricsCalculator`.
- **Amélioration :** Stocker ces bins sous forme de JSON dans la table `processing_config` de Supabase. Permettrait à Karoly d'ajuster ses zones de pondération sans toucher au code Python.
- **Impact :** Flexibilité Coach.

### 2. Raffinement du Mode Dégradé (Vélo sans Puissance)
- **Observation :** Actuellement, si la puissance manque, on estime `Power = (HR / LT2_HR) * CP`. C'est une approximation linéaire très grossière.
- **Amélioration :** Implémenter un modèle plus robuste, potentiellement basé sur le TRIMP (Training Impulse) standard pour ces séances, ou une courbe de puissance virtuelle non-linéaire.
- **Impact :** Précision des charges pour les athlètes non-équipés.

### 3. Gestion Fine des "Trous" (Pauses Longues)
- **Observation :** L'algorithme de découplage compare globalement la 1ère moitié vs la 2ème moitié de la séance (`Global Split`). Si une pause longue (ex: 15 min café) survient au milieu, la dérive cardiaque physiologique est "reset" (repos), mais l'algo continue de comparer.
- **Amélioration :** Détecter les pauses longues (> 5 min) et segmenter l'analyse (ex: calculer le drift sur les segments actifs uniquement, ou réinitialiser la baseline).
- **Impact :** Justesse physiologique sur les sorties longues avec arrêts.

### 4. Métriques Running Avancées (Stryd)
- **Observation :** On utilise la puissance Stryd brute.
- **Amélioration :** Exploiter les autres métriques Stryd (Leg Spring Stiffness, Ground Time, Vertical Oscillation) pour détecter la fatigue mécanique avant la dérive cardiaque.
- **Impact :** Prévention blessure (Phase 3).

### 6. Audit & Validation des Indices Karoly
- **Observation :** Les calculs MEC, INT, DUR et MLS ont été portés depuis les notebooks. Une vérification croisée (audit mathématique) ligne à ligne est nécessaire pour garantir qu'aucune subtilité de lissage ou de pondération n'a été perdue lors de la vectorisation (Numpy/Pandas).
- **Amélioration :** Créer une suite de tests unitaires "Golden Samples" (comparer le résultat du robot vs le résultat manuel du notebook de Karoly sur 5 fichiers .fit de référence).
- **Impact :** Crédibilité scientifique du modèle.

## ☁️ Module C/D: Database & Sync

### 7. Automatisation des "Onglets" Athlètes (Vues SQL)
- **Observation :** Karoly est habitué à une vue par athlète (onglets Excel). L'interface Supabase brute est trop complexe pour un usage quotidien fluide.
- **Amélioration :** Ajouter une étape au robot Python pour créer/mettre à jour automatiquement une vue SQL "📂 Nom Prénom" dès qu'un nouvel athlète est détecté.
- **Alternative :** Développer un Dashboard interactif (Streamlit/Glide) avec menu déroulant pour éviter l'encombrement de la barre latérale.
- **Impact :** Expérience utilisateur (UX) Coach.