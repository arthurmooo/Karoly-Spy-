# Spécification du Track : Alignement et Calibration de la MLS (Run vs Vélo)

## Aperçu
L'objectif de ce track est de corriger la surestimation systémique de la charge Mixed Load Score (MLS) pour la course à pied afin d'assurer une parité avec le vélo. La vision de référence est : **1h de course à 120 bpm (plat) = 1h de vélo à 120 bpm (plat)**.

## Problèmes identifiés
1. **Facteur de conversion erroné :** Un multiplicateur `4.184` (kcal -> kJ) est appliqué au run mais pas au vélo, créant un écart de ~400%.
2. **Profil Physiologique Unique :** L'utilisation de seuils LT1/LT2 identiques pour tous les sports fausse l'indice de charge interne (`int_index`).

## Exigences Fonctionnelles

### 1. Refonte du modèle énergétique (MEC)
- **Supprimer le facteur `4.184`** dans le calcul du coût énergétique de la course à pied.
- L'unité de base pour la charge mécanique (`mec_base`) sera désormais la "Calorie-équivalente".

### 2. Profils Physiologiques par Sport
- Modifier la base de données et l'objet `PhysioProfile` pour supporter des seuils (`lt1_hr`, `lt2_hr`, `cp`) spécifiques au sport (Bike, Run).
- Le `MetricsCalculator` doit charger le profil correspondant au sport de l'activité.

### 3. Calibration de l'Équilibre
- Introduire un **Coefficient d'Ajustement Run** global si nécessaire pour atteindre la parité parfaite sur une séance type de 1h à basse intensité.

## Critères d'Acceptation
- [ ] Une séance de 1h de run à 120 bpm stable sur plat produit une MLS identique (à +/- 5%) à une séance de 1h de vélo à 120 bpm.
- [ ] Le calcul de la MLS pour Louis Richard (test case) est recalculé et jugé cohérent par Karoly.
- [ ] Les seuils LT1/LT2 peuvent être saisis séparément pour le vélo et le run dans Supabase.
