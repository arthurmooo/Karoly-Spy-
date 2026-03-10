# Web App Backend Audit

Date: 2026-03-09

Projet cible: `Project K` (`ayczcnoxgaljkyiljill`)

Référence métier: Retool pour toutes les données déjà affichées dans le tableau Karoly.

## Légende
- `Branché`: la web app lit une vraie source back et le rendu est cohérent.
- `Partiel`: la web app lit le back mais pas avec toute la parité attendue.
- `Non branché`: contrôle visible sans implémentation exploitable dans la web app actuelle.
- `Dépendance back`: impossible à rétablir en SPA pure sans point d’accès serveur ou endpoint dédié.

## État par écran

### `Séances`
- Liste des séances: `Branché`
  Source: table `activities` + jointure `athletes`.
- Détail KPI séance: `Branché`
  Source: table `activities`.
- Intervalles / laps: `Partiel`
  Source prioritaire: `activities.segmented_metrics.interval_blocks`.
  Fallback: table `activity_intervals`.
  État: rétabli côté web app avec affichage blocs/laps réels quand disponibles.
- Graphique blocs FC + allure/puissance: `Partiel`
  Source: blocs détectés ou `activity_intervals`.
- Courbe FIT point à point FC/vitesse en fonction du temps: `Dépendance back`
  Cause: la précédente web app Next.js utilisait une route serveur dédiée `/api/activities/:id/streams`.
  La SPA Vite actuelle n’a plus cette couche serveur.
  Le bucket `raw_fits` est privé et non exploitable directement par le front actuel.
- Feedback athlète: `Partiel`
  Source: `activities.rpe` et `activities.source_json`.
  État: lecture réelle des champs disponibles (`rpe`, `feeling`, `description/comment`).
  Limite: si Nolio n’a rien stocké dans `source_json`, aucun texte ne peut être affiché.
- Notes coach vers Nolio: `Dépendance back`
  Cause: le front migré écrivait dans `activities.coach_comment`, colonne absente sur `Project K`.
  Aucun endpoint web exploitable trouvé dans cette SPA pour pousser une note vers Nolio.
- Détecteur manuel: `Dépendance back`
  Cause: le précédent front utilisait une route serveur d’analyse FIT et une route d’override.
  Ces routes ne sont plus présentes dans la SPA actuelle.

### `Athlètes > Profil`
- Liste des athlètes: `Branché`
  Source: table `athletes`.
- Profils actifs vélo/course: `Branché`
  Source: table `physio_profiles`.
  Correctif appliqué: normalisation front des sports legacy `Run/run/Bike/bike`.
- Création de profil: `Branché`
  Source: insertion dans `physio_profiles`.
  Correctif appliqué: écriture normalisée en `Run` / `Bike`.

### `Calendrier`
- Séances réalisées: `Branché`
  Source: table `activities`.
- Séances planifiées: `Dépendance back`
  Cause: la web app ciblait `planned_workouts`, table absente sur `Project K`.
  État UI: la partie reste visible mais est explicitement signalée comme indisponible.

### `Analytique / Santé`
- Tableau readiness: `Branché`
  Source: vue `view_health_radar`.
- Courbes readiness athlète: `Branché`
  Source: table `daily_readiness`.
- Import CSV HRV4Training: `Branché`
  Source: upsert dans `daily_readiness`.
- Export PDF: `Non branché`

### `Dashboard`
- KPI globaux: `Branché`
  Sources: `athletes`, `view_weekly_monitoring`, `view_health_radar`, `activities`.
- Heatmap MLS: `Branché`
  Source: vue `view_weekly_monitoring`.
- Alertes readiness visibles: `Branché`
  Source: vue `view_health_radar`.
- Recherche globale: `Non branché`
- Groupes `A/B`: `Non branché`
- Vue détaillée “Tout voir”: `Non branché`
- Création de séance: `Non branché`

### `Auth`
- Connexion coach: `Branché`
  Source: Supabase Auth + `user_profiles`.
- Mot de passe oublié: `Non branché`

## Régressions confirmées dues à la migration front
- Perte de la route serveur de streams FIT utilisée par l’ancienne web app Next.js.
- Perte de la route serveur d’override / détection manuelle.
- Ciblage d’un schéma supposé (`coach_comment`, `athlete_comment`) au lieu du schéma réel `Project K`.
- Mapping erroné des sports physio (`CAP/VELO` au lieu de `Run/Bike` et variantes legacy présentes en base).

## Ce qui a été corrigé dans ce lot
- Détail de séance réaligné sur `source_json` et `segmented_metrics`.
- Laps/blocs affichés depuis les vraies données back disponibles.
- Feedback athlète lu sur les champs réellement présents.
- Profils Louis Richard et cas similaires corrigés par normalisation sport.
- Calendrier rendu honnête sur l’absence de `planned_workouts`.
- Faux boutons/actions laissés visibles mais explicitement marqués non branchés.

## Reste à faire pour atteindre la parité web complète
- Réintroduire une surface serveur ou un endpoint dédié pour lire les FIT et renvoyer les streams à la web app.
- Réintroduire une surface serveur pour le détecteur manuel et les overrides.
- Exposer un point d’écriture web fiable pour pousser une note coach vers Nolio.
- Exposer une vraie source planifiée pour le calendrier si `planned_workouts` n’est pas la table de production à cibler.
