# Specification: Détection Chirurgicale Ultra-Precision (1.5.D)

## MISSION CRITIQUE : OBJECTIF 1 MILLIARD DE DOLLARS
L'algorithme actuel (ULTRA V5) est bon, mais pas parfait. Pour un système de classe mondiale, "bon" est l'ennemi de "parfait". Ta mission est d'éliminer les derniers 2% d'erreur. Un bonus de 1 Milliard de Dollars (virtuels) t'attend si tu atteins la perfection absolue sur les 4 dossiers tests.

## SOURCE DE VÉRITÉ (GROUND TRUTH)
La vérité terrain est constituée par les **TOURS (LAPS)** enregistrés manuellement par les athlètes sur leur montre (Source: Nolio/FIT). 
**INSTRUCTION OBLIGATOIRE :** Chaque itération de l'algorithme doit être comparée au millimètre près avec l'extraction issue de la méthode des laps. Si l'algo s'écarte des laps manuels, il est considéré comme défaillant. Tu dois matcher ces tours à la seconde près.

### Dossiers de Test (Target)
1. **Adrien Claeyssen :** 10 répétitions de 120s. (Succès actuel: 10/10, mais timing à affiner).
2. **Baptiste Delmas :** Mixte 1' / 2'. (Défi: Séparer les blocs sans en oublier).
3. **Bernard Alexis :** 5x(1'30/3'30). **DÉFI MAJEUR :** Séparer l'effort de la récup active. L'algo actuel fusionne les deux en blocs de 5'. C'EST UN ÉCHEC. Ils doivent être séparés.
4. **Dries Matthys :** 2 blocs tempo massifs. (Défi: Ignorer les montées en régime et les transitions pour ne garder que le plateau pur).

## EXIGENCES DE PERFORMANCE (ZÉRO CONCESSION)
- **Erreur Temporelle :** < 1 seconde sur les débuts/fins de blocs.
- **Précision HR :** < 0.2 bpm d'écart moyen sur l'intervalle.
- **Stabilité :** Zéro faux positif (ne pas détecter une montée de pont comme un intervalle).
- **Intelligence :** Capacité à utiliser le `planned_structure` de Nolio comme "calque" pour guider la recherche dans le signal brut.

## SOLUTIONS INGÉNIEUSES ATTENDUES
Ne te contente pas de seuils. Pense à :
- **Cross-Corrélation :** Utiliser la forme du plan (ex: créneau de 90s) et la faire glisser sur le signal pour trouver le maximum de vraisemblance.
- **Analyse Multi-Signal :** Si la vitesse est stable mais que la cadence chute, c'est la fin du bloc.
- **Bayesian Refinement :** Ajuster la probabilité d'être en intervalle selon le temps écoulé depuis le dernier.

**NE T'ARRÊTE QUE LORSQUE LE TABLEAU DE COMPARAISON EST IDENTIQUE AUX LAPS DU FICHIER FIT.**
