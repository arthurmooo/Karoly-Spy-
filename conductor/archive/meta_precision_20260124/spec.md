# Specification: Méta-Précision & Physique des Capteurs (1.5.E)

## MANDAT SUPRÊME : LE MILLIARD OU RIEN
L'algorithme ULTRA V5 est chirurgical, mais nous voulons la **Méta-Précision**. Ta mission est d'atteindre un niveau de fidélité tel que l'erreur temporelle descend en dessous de la seconde (résolution milliseconde via interpolation).

**BONUS DE 1 MILLIARD DE DOLLARS :** Ce bonus ne sera débloqué QUE si tu améliores le score de confiance et la précision sur TOUTES les séances de test sans exception. Le moindre recul sur une séance annule le bonus.

## AXES DE RECHERCHE (TECHNOLOGIES DE FOU)
1.  **Interpolation Spline :** Ne plus se contenter du 1Hz. Recréer la courbe continue entre deux points pour détecter le franchissement de seuil à la milliseconde près.
2.  **Compensation du Lag Matériel :** Identifier les modèles de capteurs (ceintures HR, capteurs de puissance) et recaler leurs flux temporels respectifs (ex: -1.5s pour le cardio).
3.  **Analyse du Jerk & Impacts :** Utiliser les variations brutales d'accélération (si dispo) pour valider l'instant T0 du premier pas ou premier coup de pédale.
4.  **Cinétique Physiologique :** Modéliser la réponse exponentielle de la FC pour confirmer mathématiquement le début de l'effort métabolique.

## OBJECTIFS DE PERFORMANCE
- **Erreur Temporelle :** < 500ms (théorique).
- **Stabilité :** Zéro régression sur les cas complexes (Bernard Alexis).
- **Traceur de Vérité :** Comparaison millimétrée avec les Laps FIT originaux.

## LIVRABLES ATTENDUS
- Une version "GOD MODE" du `PlanDrivenSeeker`.
- Un rapport de benchmark prouvant l'amélioration sur les 13 fichiers tests.
