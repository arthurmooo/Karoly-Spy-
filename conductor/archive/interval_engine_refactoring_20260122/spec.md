# Specification: Bulletproof Interval Detection & Calculation Engine

## Overview
Fiabiliser radicalement le moteur de calcul pour garantir une parité parfaite avec Nolio sur les laps propres et une détection intelligente sur les séances complexes. Le moteur doit gérer les transitions directes d'intensité (vagues) et être "Lap-proof" (robuste aux erreurs de laps de l'athlète).

## Functional Requirements

### 1. Data Integrity & Parity (Nolio Alignment)
- **Lap Extraction Audit:** Identifier pourquoi les vitesses actuelles diffèrent de Nolio même sur des laps propres. 
- **Time Management:** Clarifier et harmoniser la gestion du "Moving Time" vs "Elapsed Time" et le traitement des pauses.
- **Calculation Precision:** Assurer que `Distance / Time` sur un lap extrait du .FIT correspond exactement (à +/- 1%) à la donnée Nolio.

### 2. Robust Detection Logic ("Lap-proof")
- **Signal Analysis:** Identifier les sauts d'intensité (Puissance/Allure) pour détecter les changements de blocs, notamment les transitions directes (ex: 1km allure 10k -> 2km allure semi).
- **Structural Matching:** Corréler les blocs détectés avec le "Planned Workout" de Nolio sans connaissance préalable (test en aveugle).
- **Alignment:** Recaler la structure prévue sur le signal réel pour corriger les erreurs de timing ou de laps de l'athlète.

### 3. Complex Structure Support (Waves/Continuous)
- Gérer les séances "en vagues" sans période de repos (changement d'allure net dans le bloc de travail).
- **Gold Standard Sessions:**
    - Baptiste Delmas (08/01/2026 & 09/01/2026)
    - Bernard Alexis (17/10/2025)
    - Edouard Tiret (03/04/2025)
    - Hadrien Tabou (05/10/2025)

### 4. Fallback Mechanism
- En cas d'échec du matching intelligent (< 70% de confiance), basculer sur un découpage temporel simple (1/2, 1/4) pour assurer la continuité du calcul de load.

## Non-Functional Requirements
- **API Efficiency:** Ne pas chercher de séances à blanc sur l'API Nolio. Utiliser les IDs précis ou les fichiers déjà présents. Mise en cache systématique des structures prévues.
- **Performance:** Vectorisation maximale via Pandas pour le traitement du signal.

## Acceptance Criteria
- [ ] Écart de vitesse < 1% par rapport à Nolio sur les séances de référence.
- [ ] Identification automatique et correcte de la structure sur les 5 séances "Gold Standard" en mode aveugle.
- [ ] Recalage réussi d'un bloc avec décalage de timing > 10s.
