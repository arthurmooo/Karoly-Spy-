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
    *   *Le Problème :* Je "bouche" les trous <10s par interpolation, mais je laisse les trous >10s (pauses) comme manquants (NaN). C'est correct pour la moyenne, mais pour le calcul de NP (Moyenne glissante 30s), les périodes autour de la pause peuvent être affectées (moins de 30 échantillons).
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
