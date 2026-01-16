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
- [DANGER] 2026-01-13: Injected DUMMY LT1/LT2 (135/165) for Adrien Claeyssen to test Nolio Ingestion. MUST BE REPLACED.

---

## [Track 1.3] Ingestion Pipeline & Nolio Sync (Module B)
**Date:** 16 Janvier 2026
**Statut:** ✅ Terminé avec Réserves

### 🟢 Points de Succès (Robustesse)
1.  **Architecture Modulaire & Solide :** 
    -   Séparation claire des responsabilités : `NolioClient` (API), `StorageManager` (Supabase Storage), `IngestionRobot` (Orchestration).
    -   Utilisation de **Pydantic** (`ActivityMetadata`) pour valider les données entrantes, ce qui a permis de détecter immédiatement le problème des RPE invalides.
2.  **Résilience Réseau :**
    -   L'ajout de la logique de **Retry avec Backoff** exponentiel dans `download_fit_file` garantit que le robot ne plantera pas sur des micro-coupures réseau lors du téléchargement de centaines de fichiers.
3.  **Expérience Utilisateur (DX) :**
    -   Le script offre une visibilité excellente grâce aux barres de progression (`tqdm`) et aux logs clairs ("👤 Processing: Adrien...").
    -   L'option `--athlete` et `--days` permet des tests chirurgicaux rapides.
4.  **Auto-Guérison (Roster Sync) :**
    -   La fonction `sync_athletes_roster` est un atout majeur : elle détecte et crée automatiquement les nouveaux athlètes Nolio dans notre base, évitant une gestion manuelle fastidieuse.

### 🟠 Zones Faibles (Risques & Watchlist)
1.  **Gestion des Données "Sales" (RPE = 0) :**
    -   *Constat :* Nolio renvoie parfois `RPE=0` pour des séances où l'athlète n'a rien saisi.
    -   *Fix actuel :* Nous avons relaxé la contrainte de validation (`ge=0` au lieu de `ge=1`).
    -   *Risque :* Un RPE de 0 faussera les calculs de charge (RPE * Durée). 
    -   *Action requise :* Il faudra décider avec Karoly si 0 doit être traité comme `null` (pas de charge RPE) ou remplacé par une valeur par défaut (ex: 3).
2.  **Performance de Synchronisation (Scaling) :**
    -   *Constat :* Le robot parcourt séquentiellement chaque activité. Avec 100 athlètes sur 6 mois, cela prendra du temps.
    -   *Risque :* Lent pour une synchro quotidienne globale.
    -   *Mitigation :* Le système de vérification des doublons (par ID et Hash) est efficace, mais on pourrait optimiser en ne demandant à l'API Nolio que les activités *plus récentes* que la dernière date de synchro connue en base (Incremental Sync).
3.  **Dépendance aux Profils Physio :**
    -   *Constat :* L'erreur "ProfileManager" lors du dry-run a révélé que sans profil valide, le calcul plante ou est incomplet.
    -   *Risque :* Si Karoly ajoute un nouvel athlète mais oublie de créer son profil (LT1/LT2), l'ingestion fonctionnera mais sans métriques avancées.
    -   *Amélioration :* Ajouter une alerte explicite ou un rapport "Missing Profiles" à la fin de l'ingestion.

### 📝 Backlog Improvements
-   [ ] **Business Logic:** Clarifier la règle de gestion pour RPE=0 (Ignorer ou Default ?).
-   [ ] **Optimization:** Implémenter "Incremental Sync" (fetch only `> last_sync_date`).
-   [ ] **Observability:** Créer un rapport récapitulatif "Activités importées sans métriques (Manque Profil)".
