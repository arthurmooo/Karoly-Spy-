# 📝 Mémo : Points à valider avec Karoly Spy
*Ce document liste les pré-requis et questions stratégiques pour débloquer l'étape d'ingestion automatique (Track 1.3).*

## ⚠️ Points de Blocage Actuels (URGENT)
- [ ] **Nolio API Permissions :**
    - **Problème :** L'API renvoie `400 Not Authorized` sur tous les endpoints de données (`/get/training/`, `/get/planned/training/`, `/streams/`).
    - **Cause :** Le `Client ID` (`h7P9...`) est valide mais n'a pas les droits "Lecture Données Sensibles" activés par défaut.
    - **Action requise :** Karoly doit contacter le support Nolio (contact@nolio.io) pour demander le whitelisting de ce Client ID pour accéder aux données de ses athlètes.

## ✅ À Récupérer (Validé)
- [x] **Nolio API Credentials :** Client ID et Secret sont dans le `.env`.
- [x] **Supabase :** Connecté et opérationnel.
- [x] **Historique :** 6 mois d'import initial validé.
- [x] **Budget Cloud :** Plan Supabase PRO validé (Conservation de tous les fichiers .fit).
- [x] **Metrics :** On ne stocke PAS la charge Nolio (Focus exclusif MLS).

## 🎿 Sports Complémentaires (Watchlist Phase 2)
- [ ] **Ski de fond / Rando :** À intégrer dans les calculs MLS (Karoly a beaucoup d'athlètes concernés l'hiver). Pour l'instant, on stocke les fichiers bruts sans calcul.

## ℹ️ Informations à lui donner (Pour info)
- **Sécurité :** On a verrouillé l'accès aux données (RLS activé). Personne ne peut lire la base sans la clé Super-Admin.
- **Gestion des Sports :**
    - Vélo & Zwift/HT -> Traités comme "Vélo" (Calculs complets).
    - Course à Pied -> Traité comme "Run" (Calculs complets).
    - Autres (Natation, Ski, Muscu...) -> Importés pour l'historique, mais **pas de calcul MLS** pour l'instant (on attend la Phase 2).
- **Fiabilité :** On se concentre uniquement sur le **Réalisé** (pas le prévisionnel).
