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

### 7. Validation Réelle - Interval Engine (Track 1.5)
- **Action :** Une fois le Rate Limit Nolio levé, effectuer des runs ciblés pour valider l'extraction chirurgicale sur ce banc d'essai exhaustif :

| Athlète | Date | Structure Prévue | Type de Test / Complexité |
| :--- | :--- | :--- | :--- |
| **Adrien C.** | 07/01/26 | 10x2' Z3 / r 1' | **Base :** Répétitions classiques avec repos. |
| **Baptiste D.** | 07/12/25 | 2x(20x10"-50") | **Précision :** Très court (10s) haute fréquence. |
| **Baptiste D.** | 14/12/25 | 3x4km Tempo / r 1km | **Distance :** Blocs au km avec repos actif. |
| **Baptiste D.** | 31/12/25 | HIT (20x10-50) + (20x15-45) | **Volume :** Enchaînement de séries HIT. |
| **Baptiste D.** | 10/01/26 | 5x(12x30" Z3 / r 15") | **Structure :** Séries imbriquées (nested). |
| **Dries M.** | 11/01/26 | 2x50' LT1 / r 10' | **Endurance :** Plateaux très longs. |
| **Cyril N.** | 11/08/25 | 30x30" Z3 + 60' Z2 | **Hybride :** Fractionné + Bloc continu. |
| **Cyril N.** | 17/08/25 | 35km : 10km @ X% + 10km @ Y% | **Vague :** Changements d'allure sans repos. |
| **Cyril N.** | 12/10/25 | 4x20' progressif | **Progression :** Intensité montante. |
| **Baptiste D.** | 08/01/26 | 5x1'30'' Z3 + 3'30'' Z2 | **Transition :** Pas de repos entre Z3 et Z2. |
| **Baptiste D.** | 09/01/26 | 10x1' Z3 + 5x2' Z3 + 10' Z2 | **Mixed :** Changement de durée en cours de corps. |
| **Bernard A.** | 17/10/25 | 5x(1'30'' Z3 + 3'30'' Z2) | **Running Waves :** Alternance allure soutenue/endurance. |
| **Hadrien T.** | 07/10/25 | Test 5' | **Benchmark :** Isoler un effort max unique de 5 min. |

- **Impact :** Garantie de robustesse totale du moteur d'intervalles sur 100% des cas d'usage de Karoly.

## ☁️ Module C/D: Database & Sync

### 7. Automatisation des "Onglets" Athlètes (Vues SQL)
- **Observation :** Karoly est habitué à une vue par athlète (onglets Excel). L'interface Supabase brute est trop complexe pour un usage quotidien fluide.
- **Amélioration :** Ajouter une étape au robot Python pour créer/mettre à jour automatiquement une vue SQL "📂 Nom Prénom" dès qu'un nouvel athlète est détecté.
- **Alternative :** Développer un Dashboard interactif (Streamlit/Glide) avec menu déroulant pour éviter l'encombrement de la barre latérale.
- **Impact :** Expérience utilisateur (UX) Coach.