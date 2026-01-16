# Plan: [Phase 1 - Module B] Ingestion Pipeline & Nolio Sync (Track 1.3)

**Objectif :** Automatiser la récupération des données depuis Nolio, gérer l'authentification OAuth2, et stocker les fichiers bruts et métadonnées.

**Prerequis :**
- `NOLIO_CLIENT_ID` et `NOLIO_CLIENT_SECRET` (Voir `conductor/memo_karoly.md`).
- `AUTH_REFRESH_TOKEN` généré via le script manuel.

## 1. Sécurité & Authentification
- [x] **Task: Nolio Auth Script**
    - Script `scripts/auth_nolio_manual.py` pour générer le premier Refresh Token (Flow interactif console).
    - Classe `NolioAuthenticator` qui gère le refresh automatique du token expiré.
    - Stockage sécurisé des tokens (fichier `.env`).
- [x] **Task: Nolio API Permissions (BLOCKER)**
    - **Status:** ✅ Resolved (16/01/2026).
    - **Details:** Access to `/get/training/`, `/get/planned/training/`, and `/streams/` is confirmed.
    - **Action:** Wait for Nolio support to whitelist Client ID `h7P9...`.

## 2. Client API Nolio (Squelette)
- [x] **Task: NolioClient Implementation** [62bb20e]
    - Implémenter `projectk_core/integrations/nolio.py`.
    - Méthodes :
        - `get_managed_athletes()`: Récupère la liste (ID, Nom).
        - `get_activities(athlete_id, since_date)`: Récupère le **Réalisé** uniquement.
        - `download_file(url)`: Télécharge le .fit avec logique de **Retry** (car URL valide 1h).
    - Gestion des rate limits (Dev App: 200 req/h -> Pause ou Error si dépassé).

## 3. Stockage Cloud (Storage)
- [x] **Task: Supabase Storage Setup** [455ec13]
    - Créer un bucket `raw_fits` dans Supabase Storage (via script ou UI).
    - Classe `StorageManager` pour uploader/downloader les fichiers.
    - Structure : `raw_fits/{athlete_id}/{year}/{nolio_id}.fit`.

## 4. Pipeline d'Ingestion (Le Robot)
- [x] **Task: Ingestion Logic** [56d4915]
    - Script `scripts/run_ingest.py`.
    - **Paramètres :** `HISTORY_DAYS` (défaut 180 jours = 6 mois).
    - **Step 1 - Discovery :**
        - Récupérer liste athlètes Nolio.
        - Si `nolio_id` inconnu -> **Auto-Create Athlete** dans DB.
    - **Step 2 - Device Mapping (Magic) :**
        - Lire Serial Number dans les FIT téléchargés.
        - Peupler/Mettre à jour la table `athlete_devices`.
    - **Step 3 - Processing & Mapping Sports :**
        - Si **FIT** disponible :
            - Télécharge -> Hash MD5.
            - **Mapping Sport :**
                - `Bike`, `VirtualRide` (Zwift/HT) -> Calculateur Mode Vélo.
                - `Run`, `Trail` -> Calculateur Mode Run.
                - Autres (Ski, Swim...) -> **Pas de Calcul MLS** (Stockage brut uniquement).
            - Analyse (Module A) -> Sauvegarde DB + Upload Storage.
        - Si **Non-FIT** (Muscu, Yoga) :
            - Sauvegarde DB (Metadonnées uniquement : RPE, Durée).
    - **Step 4 - Hash Check :** Éviter de traiter deux fois le même fichier.

## 5. Validation & Rattrapage
- [x] **Task: Dry Run**
    - Tester sur 1 athlète (Toi ou Karoly) sur 1 semaine.
    - Vérifier l'apparition dans Supabase.
- [x] **Task: Security Check**
    - Vérifier que le RLS bloque bien les accès non autorisés aux nouvelles données.