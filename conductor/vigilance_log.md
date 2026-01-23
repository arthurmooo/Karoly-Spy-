# 🛡️ Vigilance Auto-Analysis Log
*Registre des audits de fin de track. Identifie les succès, les risques ("points bancales") et la watchlist technique.*

---

## [Track 1.1] Database & Athlete Registry (Modules C & D)
**Date:** 11 Janvier 2026 (Audit Rétroactif Vérifié)
**Statut:** 🟠 Terminé avec Réserves

### 🟢 Points de Succès
1.  **Schéma DB en place:** Les tables `athletes`, `physio_profiles`, `activities` existent avec les bons types de données.
2.  **Infrastructure:** Connexion Python -> Supabase fonctionnelle via `DBConnector` et variables d'environnement.
3.  **Migration Historique:** Les scripts d'import CSV existent pour récupérer la base athlètes.
4.  **Sécurité RLS Active:** RLS activé et configuré en mode "Service Role Only" (13/01/2026).

### 🔴 Failles Critiques (À Corriger Immédiatement)
*(Aucune - RLS Résolu)*

### 🟠 Points Bancales (Dettes Techniques)
1.  **Dédoublonnage Fragile (Athlètes):**
    *   *Fait :* Le script d'import vérifie l'existence par `Nom + Prénom` via une requête SELECT avant INSERT.
    *   *Risque :* Homonymes fusionnés par erreur. Race conditions possibles. Pas de contrainte UNIQUE composite en base.
    *   *Action :* Ajouter une contrainte UNIQUE (`first_name`, `last_name`) ou gérer les homonymes.
2.  **Table Devices Vide:**
    *   *Fait :* La table `athlete_devices` existe mais contient 0 lignes.
    *   *Risque :* L'attribution automatique des fichiers FIT (Track 1.3) sera impossible sans peupler cette table.
    *   *Action :* Créer un script pour extraire les Serial Numbers des fichiers FIT historiques et les associer aux athlètes.

### 🔭 Watchlist
- **Connexion Database:** Le `DBConnector` instancie un nouveau client à chaque appel (pas de Singleton strict). À surveiller si le nombre de connexions explose.

---

## [Track 1.2] The Processing Engine "Le Cerveau"
**Date:** 13 Janvier 2026
**Statut:** ✅ Terminé

### 🟢 Points de Succès (Robustesse)
1.  **Parser Universel Resilient:** L'adoption de `fitdecode` a permis de lire sans encombre des fichiers Coros complexes (avec champs propriétaires) et de gérer les erreurs de format (`invalid field size`) sans crash.
2.  **Architecture Vectorisée:** Le choix de `pandas` et du resampling 1Hz garantit une performance optimale (pas de boucles `for`) et une base saine pour les calculs futurs.
3.  **Fidélité Algorithmique:** La validation sur le fichier `allure_semi.fit` montre une corrélation physiologique forte (Drift élevé sur fatigue, Charge cohérente). Le modèle Karoly est respecté.

### 🟠 Points Bancales (Risques & Dettes Techniques)
1.  **Approximation du "Mode Dégradé" Vélo:**
    *   *Le Problème :* En l'absence de capteur de puissance, j'estime la puissance via `(HR / LT2) * CP`. C'est une linéarité théorique qui ignore la dérive cardiaque. Si l'athlète dérive (fatigue), sa HR monte, donc ma puissance estimée monte... alors que sa vraie puissance stagne ou baisse !
    *   *Risque :* Sur-estimer la charge (MEC) en fin de sortie longue.
    *   *Action :* À surveiller. Si les charges "Vélo sans Power" paraissent aberrantes à Karoly, il faudra revoir cette formule.

2.  **La Gestion des "Trous" (>10s) :**
    *   *Le Problème :* Je "bouche" les trous <10s par interpolation, mais je leaves les trous >10s (pauses) comme manquants (NaN). C'est correct pour la moyenne, mais pour le calcul de NP (Moyenne glissante 30s), les périodes autour de la pause peuvent être affectées (moins de 30 échantillons).
    *   *Risque :* Légère sous-estimation du NP autour des arrêts.
    *   *Action :* Acceptable pour la Phase 1, mais à raffiner si on veut une précision au watt près.

3.  **Dépendance aux Profils (LT1/LT2) :**
    *   *Le Problème :* Tout le calcul repose sur la justesse des seuils `LT1` et `LT2` stockés en base. Si l'historique des profils n'est pas rigoureusement à jour, l'analyse est fausse.
    *   *Risque :* "Garbage In, Garbage Out". Si Karoly oublie de mettre à jour un seuil après un test, toutes les séances suivantes sont mal analysées.
    *   *Action :* Prévoir une interface "Alerte Profil Obsolète" dans la Phase 2.

### 🔭 Watchlist (Sujets à Surveiller)
- **Performance sur gros volumes :** Comment se comporte le parser sur un historique de 5 ans (1000+ fichiers) d'un coup ? (Memory leak ?).
- **Variabilité des formats FIT :** Attention aux nouveaux appareils (ex: Suunto, Apple Watch via export tiers) qui pourraient introduire de nouveaux bugs de parsing.
- **Nouveaux Champs Coros :** `Effort Pace` est extrait mais pas encore utilisé dans le calcul de charge (on utilise `Speed` ou `Power`). C'est une opportunité manquée pour l'instant.

---

## [Track: Auto-Detection of Interval Metrics]
**Date:** 15 Janvier 2026
**Statut:** 🟠 Logic Terminé / Integration Bloquée

### 🟢 Points de Succès
1.  **Moteur de Détection Robuste:** L'algorithme (`IntervalDetector.py`) basé sur `scipy.signal` + `pandas` identifie correctement les intervalles sur 4 fichiers de test réels.
2.  **Fallback "No Power":** Le système fonctionne même pour les séances sans capteur de puissance (détection sur Vitesse), validé avec une séance Seuil 2x10'.
3.  **Clean Code:** Pydantic Models (`ActivityMetrics`) stricts implémentés partout.

### 🔴 Failles Critiques (BLOCKER)
1.  **Nolio API Permissions (Error 400):**
    *   *Situation:* Impossible d'accéder aux endpoints `/get/training` et `/get/planned`.
    *   *Impact:* On ne peut pas récupérer automatiquement la structure prévue ("3x1000m").
    *   *Conséquence:* Le moteur d'intervalles est prêt mais n'a pas de carburant (JSON plan).
    *   *Action:* Karoly doit faire whitelister son ClientID.

### 🟠 Points Bancales
1.  **Estimation Durée vs Distance:**
    *   *Risque:* L'algo attend une **durée** (secondes). Si Nolio renvoie "1000m", je dois convertir. Pour l'instant, je convertis via la vitesse max de la séance. C'est précis pour les bons coureurs, mais pourrait être faussé sur terrain vallonné.
    *   *Action:* Implanter une logique `Detect by Distance` native dans le futur.

---

## [Track: Interval Classification Maintenance]
**Date:** 23 Janvier 2026
**Statut:** ✅ Correction Déployée

### 🟢 Points de Succès
1.  **Réactivité:** Identification immédiate des séances "Tempo" et des séries avec parenthèses `5*(` qui échappaient au moteur.
2.  **Robustesse Regex:** Le `ActivityClassifier` est désormais plus permissif (`\d+\s*[*x]`) et couvre les variations de saisie du coach.
3.  **Richesse Sémantique:** Ajout de mots-clés spécifiques aux disciplines (PMA pour le vélo, Vameval pour le test, Tempo pour le travail spécifique).
4.  **Reprocessing Rétroactif:** Les 8 séances mal classées en base ont été corrigées et leurs métriques d'intervalles recalculées (validé sur Victor Alexandre et Lorena Rondi).

### 🟠 Points Bancales (Risques)
1.  **Faux Positifs "Tempo" :**
    *   *Risque :* Une sortie d'endurance intitulée "Footing Tempo Z2" pourrait être classée en intervalles. 
    *   *Mitigation :* Le score de variabilité (CV) et la présence d'une grille Nolio restent les juges de paix pour les calculs chirurgicaux.
2.  **Segmentation Natation :**
    *   *Risque :* La détection automatique des phases sur la natation (Victor Alexandre) reste moins précise que sur le vélo/run faute de GPS/Power constant.
    *   *Action :* Privilégier le marquage des Laps manuel sur la montre pour la natation.

### 🔭 Watchlist
- **Variations de titres :** Surveiller si Karoly utilise d'autres termes (ex: "Séries", "Répétitions") qui ne sont pas encore dans la liste.

---

## [Track 1.3/1.4] Ingestion Robot & Automation (Audit Post-Bugfix)
**Date:** 18 Janvier 2026
**Statut:** ✅ Stabilisé & Déployé

### 🟢 Points de Succès (Résilience de Session)
1.  **Auto-Authentification Robuste :** La boucle de rafraîchissement des jetons via Supabase (`app_secrets`) est validée.
2.  **Dashboard Coach Opérationnel :** Création de la vue SQL `dashboard_karoly` (arrondis, noms en clair).
3.  **Consigne Métier Appliquée :** Le robot respecte désormais la règle "Seuils Read-Only". 
4.  **Correction Charge Running :** La MLS Running est désormais calculée sur la base `Distance x Intensité`.
5.  **Précision Temporelle :** Extraction de l'heure atomique (`start_time`) directement du fichier FIT, réglant le problème des séances à "00:00:00".
6.  **Support Séances Manu :** Les séances sans cardio (heart_rate) ne font plus planter le robot.

### 🔴 Failles Critiques (Résolues)
1.  **Bug "130.0" (Postgres Integer) :** Éliminé par la désactivation de l'écriture automatique des profils et le forçage des types.
2.  **Erreurs 403 (RLS) :** Résolues par la suppression des tentatives d'écriture du robot dans les tables sensibles réservées au coach.

### 🟠 Points Bancales (Risques & Watchlist)
1.  **Manque de Seuils (LT1/LT2) :** Karoly n'a pas les seuils pour tous les athlètes.
    *   *Risque :* Utilisation des valeurs par défaut (130/160) qui faussent l'indice INT.
    *   *Action :* Informer Karoly qu'il doit estimer ces valeurs (ex: % de FCMax) pour plus de précision.
2.  **Rate Limit Nolio :** Le scan global de 60 athlètes d'un coup peut déclencher un blocage temporaire.
    *   *Mitigation :* Passage du robot à un rythme toutes les 2h (validé).

### 🔭 Watchlist (Sujets à Surveiller)

- **Vues SQL par athlète :** Surveiller l'ergonomie de l'interface Supabase au fur et à mesure que Karoly ajoute des vues personnalisées.

- **Audit de lissage :** Vérifier si le lissage 30s de la HR (`ffill().bfill()`) n'étouffe pas trop les variations sur les sprints courts.

---

## [Task: Live Flux UI Enhancement]
**Date:** 23 Janvier 2026
**Statut:** ✅ Code à jour / 🟠 Déploiement Manuel Requis

### 🟢 Points de Succès
1.  **Réponse au besoin métier:** Ajout de la colonne `bpm_moyen` (`avg_hr`) dans la vue `view_live_flux` pour un suivi plus fin de l'intensité en un coup d'œil.
2.  **Centralisation:** Mise à jour du fichier source des vues `006_create_coach_views.sql` pour maintenir la cohérence de la configuration DB.

### 🟠 Points Bancales (Risques)
1.  **Déploiement SQL:** Le script `scripts/apply_views.py` est actuellement un placeholder (pas d'exécuteur DDL robuste). 
    *   *Action:* La vue doit être appliquée manuellement via l'éditeur SQL de Supabase ou via une commande `psql` externe.

### 🔭 Watchlist
- **Performance des vues:** Avec l'ajout de colonnes calculées ou extraites du JSON (`segmented_metrics`), surveiller le temps de réponse du dashboard si le volume d'activités dépasse les 10 000 entrées.

---



## [Track 1.5] Interval Engine & Workout Classification

**Date:** 19 Janvier 2026

**Statut:** ✅ Terminé & Validé (Adrien 10x2')



### 🟢 Points de Succès

1.  **Liaison Plan Robuste :** Le mécanisme de fallback "Same Week" permet de retrouver les séances prévues même quand Nolio ne fournit pas de lien direct `planned_id`.

2.  **Détection Chirurgicale :** L'algorithme de "Strict Window Sliding" (IntervalMatcher) isole parfaitement les répétitions sur les séances types (validé sur Adrien Claeyssen 10x2').

3.  **Classification Automatique :** Distinction fiable entre Endurance, Intervalles et Compétition basée sur le plan ET le signal (CV de la puissance/vitesse).

4.  **Respect Score :** Calcul du % d'adhérence à l'intensité cible Karoly (Realized / Target).



### 🟠 Points Bancales (Dettes Techniques)

1.  **Conversion Distance -> Durée :**

    *   *Le Problème :* Pour les plans en kilomètres (ex: 3x4km), le matcher estime la durée via une allure par défaut (4:00/km).

    *   *Risque :* Si l'athlète est beaucoup plus lent ou plus rapide, la fenêtre glissante de détection est décalée.

    *   *Action (Phase 2) :* Utiliser l'allure seuil (CS) réelle de l'athlète pour une estimation personnalisée.

2.  **Séries Imbriquées (Nested Reps) :**

    *   *Le Problème :* Le parser aplatit tout en une liste linéaire. Sur des structures complexes (ex: 5x(12x30/30)), le mode "Blind" (sans plan) peut fusionner des blocs.

    *   *Action :* Prioriser systématiquement la saisie structurée dans Nolio.



### 🔭 Watchlist

- **Consommation Quota Nolio :** L'ajout d'un appel API par séance pour récupérer la structure (`structured_workout`) double quasiment le nombre de requêtes. Surveiller le Rate Limit.

- **Natation :** Les structures de natation Nolio sont souvent fragmentées (nombreux petits blocs). À tester spécifiquement.

---
