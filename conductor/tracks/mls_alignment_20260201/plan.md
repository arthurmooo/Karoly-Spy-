# Implementation Plan: MLS Alignment & Sport-Specific Profiles

## Phase 1 : Infrastructure & Profils (Multi-Seuils)
- [x] Task: Migration Supabase pour ajouter la colonne `sport` (bike/run) à la table `physio_profiles`. [464a838]
- [x] Task: Mise à jour du modèle `PhysioProfile` dans `projectk_core/logic/models.py`. [464a838]
- [x] Task: Adapter `MetricsCalculator` pour charger le bon profil (LT1/LT2/CP) selon l'activité. [544a9fa]
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [checkpoint: 743efb6]

## Phase 2 : Calibration & Suppression du facteur 4.184
- [ ] Task: Supprimer le multiplicateur `4.184` dans `projectk_core/processing/calculator.py`.
- [ ] Task: Créer un test TDD simulant l'équivalence 1h Bike vs 1h Run à 120bpm.
- [ ] Task: Identifier et appliquer le **Coefficient d'Équilibre** global pour le run.
- [ ] Task: Vérifier que la logique de dénivelé (`100m D+ = 1km plat`) est bien isolée et conforme.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3 : Reprocess & Validation Louis Richard
- [ ] Task: Initialiser les deux profils de Louis (Bike vs Run) avec ses vraies valeurs.
- [ ] Task: Lancer un recalcul global de ses séances depuis le 1er janvier.
- [ ] Task: Valider l'équilibre sur la séance du 1er février.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
