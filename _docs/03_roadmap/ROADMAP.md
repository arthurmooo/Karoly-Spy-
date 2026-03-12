**PROJECT K**

> **État au 2026-03-12** — Sprint 1 ✅ complet · Sprint 2 ✅ largement
> complet (US-09c RPE/MLS reste ouvert) · Sprint 3+ non commencé ·
> Avance ~4 jours sur le planning officiel (démarrage 16/03)

Roadmap Scrum --- MVP Lot 1

Sprints 1--6 · 70 heures · 6 semaines

16 mars → 24 avril 2026

Coach Karoly Spy · KS Endurance

*Framework : Scrum adapté solo dev · Clean Architecture*

*Domain / Repository / Use Case / UI*

📋 Definition of Done (DoD) --- Globale

Toute user story est Done uniquement si toutes ces cases sont cochées :

- \[ \] tsc \--noEmit passe sans erreur (TypeScript strict)

- \[ \] Séparation des couches respectée : pas de query Supabase directe
  dans un composant UI

- \[ \] Code auto-reviewé + passé par Claude Code (lint + suggestions)

- \[ \] Tests écrits : unitaire (Vitest) pour la logique métier, E2E
  (Playwright) pour les parcours critiques

- \[ \] Feature testée sur staging Railway avant merge sur main

- \[ \] RLS Supabase vérifiée : session athlète ne peut pas lire les
  données d'un autre

- \[ \] Responsive validé : mobile + desktop (Chrome DevTools min.
  375px)

- \[ \] Zéro console.error en prod

- \[ \] PR mergée sur main → deploy automatique Railway déclenché et
  vert

🏗️ Architecture Clean --- Couches du projet

app/ → Routing Next.js (App Router)

(coach)/ → Routes protégées coach

(athlete)/ → Routes protégées athlète

api/ → API Routes (Use Cases exposés en REST)

types/ → Entités domaine (Activity, Athlete, PhysioProfile...)

repositories/ → Accès données Supabase (1 fichier par entité)

services/ → Use Cases / logique métier (calculs, agrégations)

components/ → Composants UI purs (aucune logique métier)

lib/supabase/ → Client browser + server (SSR)

lib/auth/ → Helpers session, middleware

> *Règle : un composant UI n'importe jamais depuis repositories/. Il
> passe par un service/ ou une api/ route.*

⚠️ Pré-Sprint --- À faire avant le 16/03

> *Goal : zéro dette technique non maîtrisée à J0*

- \[x\] Push interval_matcher.py + calculator.py (fixes dry-run validés
  11/02)

- \[x\] python run_k.py reprocess ciblé sur les séances concernées
  post-push

- \[ \] Envoyer rapport post-write à Karoly (Louis vélo + Thierry HT à
  valider)

- \[x\] Confirmer domaine app.karolyspy.com avec Karoly (DNS acheté ?)

- \[x\] Créer compte Railway + récupérer token deploy

- \[x\] Créer repo GitHub projectk-dashboard (privé, branching : main +
  develop)

  ------------------------------------------------- ---------------------
  **🔧 Sprint 1 --- Foundation & Auth**              16--20 mars **· 9h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *L'application Next.js est déployée en production avec une
> authentification coach fonctionnelle. Aucune feature métier ---
> uniquement l'architecture solide sur laquelle tout le reste sera
> construit.*

📝 Sprint Planning · Lundi 16/03 matin · 30 min

- \[x\] Revoir les US ci-dessous et confirmer les critères d'acceptance

- \[x\] Vérifier les prérequis : Railway token, Supabase keys prod,
  domaine

- \[x\] Découper les US en tâches journalières si nécessaire

**Lundi 16/03 · 2h ⚡** *Couches : Domain + Infrastructure*

**US-01** --- *En tant que développeur, je veux un projet Next.js
structuré selon Clean Architecture afin que chaque couche soit testable
et indépendante.*

- \[x\] npx create-next-app@latest --- TypeScript strict, Tailwind, App
  Router

- \[x\] Créer l'arborescence Clean : types/, repositories/, services/,
  components/, lib/supabase/

- \[x\] lib/supabase/client.ts (browser) + lib/supabase/server.ts
  (SSR/RSC)

- \[x\] types/index.ts : types Athlete, Activity, PhysioProfile alignés
  sur le schéma Supabase existant

- \[x\] Smoke test : query athletes depuis un Server Component → données
  affichées

**Acceptance criteria :**

- \[✓\] tsc \--noEmit → 0 erreur

- \[✓\] Aucune query Supabase en dehors de repositories/ ou lib/

- \[✓\] Structure de dossiers validée

**Mardi 17/03 · 2h ⚡** *Couches : Infrastructure (Auth)*

**US-02** --- *En tant que coach, je veux me connecter via magic link
afin d'accéder au dashboard sans gérer de mot de passe.*

- \[x\] Supabase Auth : activer magic link (email) dans le dashboard
  Supabase

- \[x\] lib/auth/middleware.ts : redirect /login si session absente

- \[x\] app/(auth)/login/page.tsx : formulaire email → envoi magic link

- \[x\] RLS Supabase : policy coach_full_access + policy
  athlete_own_data

\[ \] Préparer l\'architecture multi-coach dès le départ : table coaches
ou champ coach_id dans athletes, RLS policy basée sur coach_id (chaque
entraîneur n\'accède qu\'à ses propres athlètes --- Karoly + Steven
Galibert)

- \[x\] Test : login coach → redirect /dashboard · login sans auth →
  /login

**Acceptance criteria :**

- \[✓\] Route /dashboard inaccessible sans auth (302 redirect)

- \[✓\] RLS active : requête depuis session athlète = 0 ligne hors son
  scope

- \[✓\] Magic link reçu dans les 30s

**Mercredi 18/03 · 2.5h** *Couches : Infrastructure (Deploy)*

**US-03** --- *En tant qu'équipe, je veux un pipeline CI/CD afin que
chaque merge sur main déploie automatiquement sans intervention
manuelle.*

- \[x\] Railway : créer projet, lier repo projectk-dashboard, config
  build Next.js

- \[x\] Variables d'env prod : NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

- \[x\] Domaine app.karolyspy.com → CNAME Railway + SSL automatique
  Let's Encrypt

- \[x\] Premier deploy prod : page /login accessible en HTTPS

**Acceptance criteria :**

- \[✓\] app.karolyspy.com répond en HTTPS sans warning SSL

- \[✓\] Variables d'env injectées (pas de secrets en dur dans le code)

**Jeudi 19/03 · 1.5h ⚡** *Couches : Infrastructure (CI/CD)*

**US-04** --- *En tant que développeur, je veux un pipeline GitHub
Actions afin de détecter les régressions avant chaque deploy.*

- \[x\] .github/workflows/deploy_frontend.yml : lint TS (tsc
  \--noEmit) + build Next.js + deploy Railway

- \[x\] Déclenché sur push main uniquement (pas sur develop)

- \[x\] Test : push dummy commit → pipeline vert + deploy automatique

**Acceptance criteria :**

- \[✓\] Pipeline échoue si tsc a des erreurs (bloque le merge)

- \[✓\] Deploy Railway déclenché uniquement après lint + build OK

**Vendredi 20/03 · 1h + Review + Retro** *Couches : UI*

**US-05** --- *En tant que coach, je veux une navigation claire afin de
me repérer dans l'application dès le premier jour.*

- \[x\] components/layout/Sidebar.tsx : liens Coach / Athlètes /
  Calendrier / Bilan

- \[x\] Auth guard : HOC ou middleware par groupe de routes (coach)/

- \[x\] Deploy et test sur prod

**🔍 Sprint Review · 30 min**

- \[x\] Démo : login → dashboard → sidebar → logout sur
  app.karolyspy.com

- \[x\] Sprint Goal atteint ?

- \[x\] Montrer à Karoly ou à soi-même : l'infra est solide

**🔄 Sprint Retrospective · 15 min**

- \[ \] Ce qui a bien marché :

- \[ \] Ce qui peut s'améliorer :

- \[ \] 1 action concrète pour Sprint 2 :

**🎉 Jalon 1 --- Facture 933 € (Setup validé)**

  ------------------------------------------------- ---------------------
  **📊 Sprint 2 --- Module 1 · Dashboard Coach**    23--27 mars **· 13h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *Le coach peut consulter toutes ses activités, filtrer par
> athlète/sport/date, et éditer manuellement les intervalles ---
> migration fonctionnelle depuis Retool.*

📝 Sprint Planning · Lundi 23/03 matin · 30 min

- \[x\] Vérifier que les views Supabase view_weekly_monitoring et
  view_intervals_karo sont accessibles depuis le client Next.js

- \[x\] Confirmer la liste des colonnes utiles avec Karoly si nécessaire

- \[x\] Prioriser les US du sprint

**Lundi 23/03 · 2.5h ⚡** *Couches : Repository + UI*

**US-06** --- *En tant que coach, je veux voir la liste de toutes les
activités afin d'avoir une vue globale de ma flotte d'athlètes.*

- \[x\] repositories/activity.repository.ts : getActivities({ page,
  filters }) --- query view_weekly_monitoring avec .range()

- \[x\] services/activity.service.ts : mapper les données brutes vers le
  type Activity

- \[x\] components/tables/ActivityTable.tsx : colonnes athlète, sport,
  date, durée, MLS, type

- \[x\] Pagination côté Supabase (pas de SELECT \* sans limite)

\[x\] Colonnes supplémentaires dans ActivityTable : RPE déclaré (Nolio),
score MLS modulé RPE, allure/puissance moyenne

**Acceptance criteria :**

- \[✓\] Requête Supabase uniquement dans repositories/

- \[✓\] Pagination fonctionnelle : 25 lignes / page

- \[✓\] Tri par date desc par défaut

**Mardi 24/03 · 3h ⚡** *Couches : Use Case + UI*

**US-07** --- *En tant que coach, je veux filtrer les activités par
athlète, sport et date afin de trouver rapidement une séance.*

- \[x\] services/filter.service.ts : construire les params de filtre
  Supabase dynamiquement

- \[x\] components/filters/ActivityFilters.tsx : select athlète,
  multi-select sport, date range picker

- \[x\] URL state : filtres persistés dans les query params
  (?athlete=x&sport=run)

**US-08** --- *En tant que coach, je veux corriger manuellement le
rythme moyen et dernier intervalle afin de garder une donnée fiable
quand l'algo se trompe.*

- \[x\] repositories/activity.repository.ts : updateIntervalOverride({
  activityId, paceAvg, paceLast })

- \[x\] app/api/activities/\[id\]/override/route.ts : API Route POST →
  update avec manual_override: true

- \[x\] Inline edit dans ActivityTable (double-clic → input → save →
  optimistic update)

**Acceptance criteria :**

- \[✓\] Filtres persistés si la page est rechargée

- \[✓\] Override enregistré en DB avec manual_override: true
  (traçabilité)

- \[✓\] Pas d'appel Supabase direct depuis le composant UI

**Mercredi 25/03 · 2.5h ⚡** *Couches : Service + UI*

**US-09** --- *En tant que coach, je veux voir une heatmap de charge de
toute ma flotte afin d'identifier en un coup d'œil qui est en
surcharge.*

- \[x\] repositories/load.repository.ts : getFleetLoad() --- group by
  athlete_id + week_start, aggrégat MLS

- \[x\] services/load.service.ts : normaliser MLS entre 0 et 1 pour le
  dégradé couleur

- \[x\] components/charts/FleetHeatmap.tsx : grille athlètes × semaines,
  couleur vert→rouge

- \[x\] Tooltip au survol : nom athlète, semaine, valeur MLS brute

\[x\] Base de calcul de la heatmap : Puissance Critique (CP) et Vitesse
Critique (CS) --- disponibles pour tous les athlètes, équivalents
scientifiques de LT1/LT2. La heatmap est complète pour tous dès le
lancement

**Acceptance criteria :**

- \[✓\] Rendu correct avec 10+ athlètes et 12 semaines

- \[✓\] Couleur basée sur normalisation relative (pas valeur absolue
  hardcodée)

**Jeudi 26/03 · 2.5h ⚡** *Couches : Domain + Repository + UI*

**US-10** --- *En tant que coach, je veux consulter l'historique des
profils physio de chaque athlète afin de comprendre l'évolution de ses
seuils.*

- \[x\] types/index.ts : type PhysioProfile avec valid_from, lt1, lt2,
  cp, cs

- \[x\] repositories/physio.repository.ts : getProfiles(athleteId) ---
  tri valid_from desc

- \[x\] repositories/physio.repository.ts : insertProfile(profile) ---
  pas d'UPDATE (SCD2)

- \[x\] components/physio/PhysioHistory.tsx : timeline + form ajout
  nouveau profil

**Acceptance criteria :**

- \[✓\] Aucun UPDATE sur physio_profiles (insert only --- SCD Type 2
  respecté)

- \[✓\] Nouveau profil visible immédiatement après insert (revalidation
  cache Next.js)

**Vendredi 27/03 · 2.5h ⚡** *Couches : Repository + UI*

**US-11** --- *En tant que coach, je veux importer un CSV HRV 4 Training
afin de visualiser l'état de forme de mes athlètes en attendant
l'endpoint Nolio.*

- \[x\] app/api/hrv/import/route.ts : parse CSV multipart → validation →
  insert hrv_entries

- \[x\] repositories/hrv.repository.ts : insertHrvBatch(entries\[\]) +
  getHrvSeries(athleteId, days)

- \[x\] services/hrv.service.ts : calcul moyenne glissante 7j

- \[x\] components/charts/HrvChart.tsx : Recharts LineChart LnRMSSD +
  moyenne 7j

\[x\] Intégrer la FC repos (resting heart rate) depuis le CSV HRV 4
Training --- affichage en tendance sur le graphique

> *⚠️ Source temporaire --- endpoint Nolio non disponible*

**Acceptance criteria :**

- \[✓\] Import CSV idempotent (pas de doublons si re-import du même
  fichier)

- \[✓\] Courbe affichée avec minimum 7 points pour calculer la moyenne

US-09b --- En tant que coach, je veux détecter manuellement des
intervalles sur une séance (fallback Nolio) afin d\'analyser les séances
que l\'algorithme ne détecte pas automatiquement.

\[x\] Interface de sélection : choix de la métrique cible (allure,
puissance ou FC), nombre de segments recherchés, durée de chaque segment
(en minutes ou en km)

\[x\] services/intervals.service.ts : appel backend → identification des
meilleurs segments correspondants sur le graphe de la séance

\[x\] components/intervals/ManualIntervalDetector.tsx : interface de
sélection + mise en surbrillance des segments détectés sur le graphe +
affichage en tableau avec métriques de chacun

\[x\] Injection en un clic : les valeurs détectées sont injectées dans
les colonnes de métriques d\'intervalles (pace mean, pace last, HR mean,
HR last...)

\[x\] app/api/activities/\[id\]/manual-intervals/route.ts : POST →
persistance des intervalles manuels en DB

Acceptance criteria :

\[✓\] L\'algo identifie les N meilleurs segments sur la métrique choisie

\[✓\] Les valeurs injectées sont persistées en DB avec source =
\'manual\'

\[✓\] Le graphe de la séance met en surbrillance les segments identifiés

\[✓\] Pas de conflit avec les intervalles détectés automatiquement
(override explicite)

US-09c --- En tant que coach, je veux que le score de charge MLS intègre
le RPE athlète (saisi sur Nolio à l\'upload de séance) afin que la
charge devienne métabolique, mécanique ET perceptive.

\[ \] services/load.service.ts : formule MLS modulée par le RPE déclaré
par l\'athlète sur Nolio

\[ \] Modification backend Python (calculator.py) : intégrer le RPE dans
le calcul MLS si disponible

\[ \] Affichage du RPE à côté du score MLS dans la table des activités
et dans les fiches séance

Acceptance criteria :

\[✓\] MLS recalculé avec RPE quand le RPE est disponible

\[✓\] Séances sans RPE : MLS inchangé (pas de régression)

\[✓\] RPE visible dans la table des activités (colonne dédiée)

US-09d --- En tant que coach, je veux voir le commentaire laissé par
l\'athlète sur sa séance Nolio afin d\'avoir son ressenti directement
dans la fiche séance sans quitter l\'application.

\[x\] Migration Supabase : ajouter colonne `athlete_comment TEXT` dans
la table `activities` (migration 045 créée, à appliquer)

\[x\] `projectk_core/db/writer.py` : inclure `athlete_comment` dans
`serialize()` en lisant `source_json.get("description")` (champ réel
Nolio — `comment` n\'existe pas dans l\'API)

\[x\] `scripts/run_ingest.py` : writer lit directement depuis
`source_json`, pas de passage explicite nécessaire (forward-only, pas
de backfill --- coûteux en quota API)

\[x\] Affichage dans la fiche séance (Activity Detail) : encart
commentaire athlète, affiché uniquement si non vide

Acceptance criteria :

\[✓\] Le commentaire est persisté en DB sur toutes les nouvelles
ingestions

\[✓\] Aucun backfill automatique des activités historiques (quota Nolio
préservé)

\[✓\] Si le champ est vide, aucun encart affiché (pas de section vide)

**🔍 Sprint Review · 30 min**

- \[x\] Démo parcours coach complet : liste → filtres → heatmap → profil
  physio → HRV

- \[x\] Sprint Goal atteint ? (US-09c reste en suspens)

- \[x\] Comparer avec Retool : fonctionnellement équivalent ?

**🔄 Sprint Retrospective · 15 min**

- \[ \] Ce qui a bien marché :

- \[ \] Ce qui peut s'améliorer :

- \[ \] 1 action concrète pour Sprint 3 :

  ------------------------------------------------- ---------------------
  **📊 Sprint 3 --- Module 1 fin · Module 2 début**  30 mars--3 avril **·
                                                                    13h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *Le coach peut reprocesser une séance depuis l'UI, gérer ses athlètes,
> et un athlète peut se connecter et voir son propre calendrier.*

📝 Sprint Planning · Lundi 30/03 matin · 30 min

- \[ \] Vérifier que run_k.py reprocess est accessible via subprocess ou
  API dédiée

- \[ \] Confirmer le modèle de rôles : role stocké dans auth.users
  metadata ou table dédiée ?

**Lundi 30/03 · 2h** *Couches : Use Case + Infrastructure*

**US-12** --- *En tant que coach, je veux déclencher le recalcul d'une
séance depuis l'UI afin de corriger une ingestion erronée sans passer
par le terminal.*

- \[ \] app/api/activities/\[id\]/reprocess/route.ts : POST → execSync
  python run_k.py reprocess

- \[ \] Feedback UI : spinner pendant le reprocess + toast succès/erreur

- \[ \] Guard : endpoint accessible uniquement par le coach
  (vérification role)

**US-13** --- *En tant que coach, je veux inviter un athlète par email
et l'assigner à un groupe afin de gérer ma flotte.*

- \[ \] repositories/athlete.repository.ts : inviteAthlete(email, group)
  → Supabase Auth inviteUserByEmail()

- \[ \] repositories/athlete.repository.ts :
  updateAthleteGroup(athleteId, group)

- \[ \] components/athletes/AthleteList.tsx : liste + bouton invite +
  select groupe (élite/loisir)

\[ \] Désactivation ou suppression d\'un compte athlète (avec
confirmation)

\[ \] Tri et filtrage par groupe dans la liste des athlètes

\[ \] Architecture multi-entraîneurs : champ coach_id sur chaque
athlète. Chaque coach ne voit que ses propres athlètes (préparé pour
Karoly + collaborateurs comme Steven Galibert)

Acceptance criteria :

\[✓\] Invitation fonctionnelle : l\'athlète reçoit un email et peut
créer son compte

\[✓\] Suppression d\'un athlète le retire de la flotte sans supprimer
ses données historiques

\[✓\] Filtrage par groupe opérationnel (Elite / Préparation / Loisir)

\[✓\] Isolation multi-coach : un coach ne voit jamais les athlètes d\'un
autre coach

**Mardi 31/03 · 2h ⚡** *Couches : Infrastructure (Auth multi-rôles)*

**US-14** --- *En tant que système, je veux router automatiquement coach
et athlète vers leur espace dédié afin que chacun voie uniquement ce qui
le concerne.*

- \[ \] lib/auth/roles.ts : getRole(session) → coach \| athlete

- \[ \] Middleware Next.js : coach → /(coach)/dashboard, athlete →
  /(athlete)/mon-espace

- \[ \] RLS renforcée : policy athlete_own_activities --- auth.uid() =
  athlete_user_id

- \[ \] Test : session athlète → requête activities → 0 résultat hors
  son scope

\[ \] RLS multi-coach : policy coach_own_athletes --- chaque coach ne
voit que les athlètes assignés via coach_id. Préparé pour Karoly +
Steven Galibert dès le départ

**Acceptance criteria :**

- \[✓\] Athlète ne peut pas accéder aux routes /(coach)/

- \[✓\] Coach ne peut pas accéder aux routes /(athlete)/ (séparation
  forte)

- \[✓\] RLS vérifiée via Supabase Studio (logs)

\[✓\] Un coach ne voit que les athlètes qui lui sont assignés (isolation
par coach_id --- préparé pour multi-entraîneurs)

**Mercredi 01/04 · 3h ⚡** *Couches : Repository + UI*

**US-15** --- *En tant qu'athlète, je veux voir mon calendrier
d'entraînement afin de visualiser ma charge semaine par semaine.*

- \[x\] repositories/calendar.repository.ts :
  getCalendarActivities(athleteId, startDate, endDate)

- \[x\] services/calendar.service.ts : grouper les activités par jour →
  structure CalendarDay\[\]

- \[x\] components/calendar/CalendarGrid.tsx : grille
  semaine/mois/année, case colorée par sport/type

- \[x\] Navigation prev/next (semaine et mois)

**Jeudi 02/04 · 3h ⚡** *Couches : UI*

**US-15 (suite) --- Interactions calendrier**

- \[x\] Toggle vue Semaine ↔ Mois ↔ Année (état local, pas de
  rechargement)

- \[x\] Filtres sports : toggle running / vélo / natation (state dans
  URL)

- \[x\] Clic sur une case → routing vers /activite/\[id\] (stub page
  pour l'instant)

**Acceptance criteria :**

- \[✓\] Calendrier performant avec 1 an de données (virtualization ou
  pagination par mois)

- \[✓\] URL reflète la semaine/mois affiché (partageable)

**Vendredi 03/04 · 3h** *Couches : QA + Buffer*

- \[ \] Buffer corrections bugs remontés en S1/S2/S3

- \[ \] playwright test : parcours coach complet (login → liste → filtre
  → heatmap → logout)

- \[ \] Deploy staging propre --- test cross-browser (Chrome + Safari)

- \[ \] Vérifier que le robot d'ingestion (robot_v8.yml) et le frontend
  CI/CD ne se marchent pas dessus

**🔍 Sprint Review · 30 min**

- \[ \] Démo : coach reprocess + invite athlète + athlète se connecte et
  voit son calendrier

- \[ \] Sprint Goal atteint ?

**🔄 Sprint Retrospective · 15 min**

- \[ \] Ce qui a bien marché :

- \[ \] Ce qui peut s'améliorer :

- \[ \] 1 action concrète pour Sprint 4 :

**🎉 Jalon 2 --- Facture 933 € (M1 + M2 début livrés en staging)**

  ------------------------------------------------- ---------------------
  **👤 Sprint 4 --- Module 2 · Espace Athlète**     6--10 avril **· 17h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *Un athlète peut consulter le détail de chaque séance, lire les
> commentaires de son coach, donner son ressenti, et voir ses tendances
> HRV personnelles.*
>
> *⚠️ Lundi 6 avril = Lundi de Pâques --- journée off possible,
> rattrapée mardi*

📝 Sprint Planning · Lundi 06/04 (ou mardi 07) · 30 min

- \[ \] Vérifier que la table activity_intervals contient les colonnes
  pace_mean, pace_last, confidence, detection_source

- \[ \] Confirmer le modèle de feedback athlète (nouveau champ ou table
  dédiée ?)

**Lundi 06/04 · 2h** *Couches : Repository + UI*

**US-16** --- *En tant que coach ou athlète, je veux filtrer les séances
par sport, durée et type afin de naviguer efficacement dans
l'historique.*

- \[ \] services/filter.service.ts : étendre le service existant pour
  l'espace athlète

- \[ \] components/filters/SessionFilters.tsx : composant réutilisable
  (coach + athlète)

- \[ \] Intégration dans /(athlete)/mon-espace et /(coach)/dashboard

\[ \] Affichage du groupe de l\'athlète (Elite / Préparation / Loisir)
dans son espace personnel --- l\'athlète voit à quel groupe il
appartient

**Mardi 07/04 · 3h ⚡** *Couches : Repository + Service + UI*

**US-17** --- *En tant qu'athlète, je veux voir le détail d'une séance
avec le graphique découplage et mes intervalles afin de comprendre ma
performance.*

- \[x\] repositories/activity.repository.ts : getActivityDetail(id) ---
  join activities + activity_intervals

- \[ \] services/activity.service.ts : calculer le découplage
  FC/puissance

- \[ \] components/charts/DecouplingChart.tsx : Recharts LineChart
  dual-axis (FC + pace/puissance)

- \[x\] components/tables/IntervalsTable.tsx : pace_mean, pace_last,
  confidence, detection_source

Données communes (toutes séances) :

\[x\] Métriques de base affichées : sport & date, durée totale, distance
totale (km, 2 décimales), FC moy/max, score MLS (modulé RPE si dispo),
RPE déclaré (Nolio), allure ou puissance moyenne (min/km pour run,
min/100m pour nat, Watts pour vélo)

\[ \] components/charts/MainChart.tsx : courbe FC + allure/puissance
colorée par zone %CP-CS (6 sous-zones : Z1i, Z1ii, Z2i, Z2ii, Z3i, Z3ii)
avec lignes horizontales de délimitation des zones. Profil de dénivelé
en arrière-plan si données GPS disponibles

\[ \] Zones FC --- modèle Karoly : Z1 (\< LT1, 55-89% CP-CS) → Z1i +
Z1ii \| Z2 (LT1-LT2, 90-105% CP-CS) → Z2i + Z2ii \| Z3 (\> LT2, \> 106%
CP-CS) → Z3i + Z3ii

\[ \] components/charts/ZoneDistribution.tsx : répartition des zones de
FC en barres ou camembert (6 sous-zones basées sur %CP-CS)

\[ \] ⚠️ Emplacement réservé pour le tracé GPS interactif (Leaflet +
OpenFreeMap) --- sera implémenté avec le Module 6 (LOT 2). Prévoir le
composant stub et l\'espace dans le layout

Séances Endurance :

\[ \] Découplage cardiaque (%) : dérive de la FC par rapport à
l\'allure/puissance, 2e moitié vs 1re moitié. Seuil d\'alerte à définir
avec Karoly

\[ \] Métriques split : allure 1re moitié / 2e moitié + FC 1re moitié /
2e moitié

\[ \] Indice de durabilité : score calculé à partir du découplage.
Comparaison aiguë : vs la séance précédente et les 3-4 dernières séances
du même type. Comparaison chronique : vs les 4 dernières semaines, 3
derniers mois, 6 derniers mois

\[ \] components/charts/DecouplingVisual.tsx : courbe FC divisée en deux
zones (1re et 2e moitié) avec l\'écart mis en évidence visuellement

\[ \] Alerte dérive cardiaque anormale : \'FC en hausse de X% sur la 2e
moitié malgré une allure stable --- surveiller la récupération\'

Séances Intervalles :

\[ \] Métriques intervalles : nb intervalles réalisés vs planifiés,
allure/puissance moyenne des intervalles (pondérée), allure/puissance du
dernier intervalle, FC moyenne des intervalles (phases de travail
uniquement), écart planifié vs réalisé (%)

\[ \] components/charts/IntervalChart.tsx : graphique double axe par
intervalle --- vitesse/allure (bleu) + FC (orange), un point par
intervalle. Lignes horizontales en pointillés : CP/CS + LT1 HR et LT2 HR
si disponibles. Sous-graphe HR drift % par intervalle (1re moitié vs 2e
moitié en barres groupées)

\[ \] components/tables/IntervalDetailTable.tsx : tableau détaillé par
intervalle --- colonnes : pa_hr (allure/puissance par batt.),
hr_drift_pct, power_drift_pct, cardiac_cost_hr_per_kmh,
cardiac_cost_hr_per_power. Mise en évidence des valeurs hors norme

\[ \] components/charts/TargetVsActualChart.tsx : histogramme cible vs
réalisé par intervalle (allure/puissance planifiée vs réalisée)

\[ \] Alerte intensité supérieure au plan : \'Tu es allé X% plus
vite/fort que prévu sur ces intervalles --- attention au contrôle de
l\'intensité\'

\[ \] Alerte dégradation en fin de série : si l\'allure/puissance du
dernier intervalle est significativement inférieure au premier :
\'Dégradation détectée sur les derniers intervalles --- la fatigue a pu
impacter la qualité de la séance\'

Séances Tempo (sous-type d\'intervalles, détecté automatiquement par la
présence de \'Tempo\' dans le titre Nolio) :

\[ \] components/charts/TempoSegmentAnalysis.tsx : analyse 4 segments
par distance --- 4 panneaux : (1) FC vs distance par segment avec FC moy
annotée, (2) Vitesse vs distance par segment avec vitesse moy annotée,
(3) Ratio FC/Vitesse vs distance par segment, (4) Barres de découplage
relatif par période : HR_decoupling, Speed_decoupling, Ratio_decoupling
côte à côte

\[ \] components/charts/TempoPhaseComparison.tsx : comparaison Phase 1
vs Phase 2 --- 2 panneaux superposés : (1) Vitesse vs distance ---
courbe Phase 1 (bleu) et Phase 2 (rouge) avec moyennes V1 et V2 en
pointillés, (2) FC vs distance --- mêmes phases avec moyennes HR1 et HR2
annotées. Une phase = une allure cible (ex : 5km à 3\'30 + 3km à 3\'10 =
5km de phase 1 et 3km de phase 2)

\[ \] Métriques Tempo : vitesse moyenne Phase 1 / Phase 2, FC moyenne
Phase 1 / Phase 2, découplage relatif par segment (HR_decoupling,
Speed_decoupling, Ratio_decoupling calculés séparément sur chacun des 4
segments)

\[ \] Alerte dégradation progressive Tempo : si le découplage augmente
significativement du segment 1 au segment 4 : \'Dégradation progressive
détectée --- la fatigue s\'est installée à partir du segment X\'

**Acceptance criteria :**

- \[✓\] Graphique lisible sur mobile (responsive)

- \[✓\] detection_source affiché avec badge coloré (plan / lap / algo)

\[✓\] Affichage adapté automatiquement au type de séance (endurance /
intervalles / tempo)

\[✓\] Les 6 sous-zones FC correspondent au modèle Karoly : Z1i/Z1ii (\<
LT1), Z2i/Z2ii (LT1-LT2), Z3i/Z3ii (\> LT2)

\[✓\] Alertes conditionnelles affichées uniquement quand le seuil est
franchi

\[✓\] Données communes (métriques de base + courbe FC/allure par zone)
présentes sur toutes les fiches

**Mercredi 08/04 · 3h** *Couches : Use Case + UI*

**US-18** --- *En tant que coach, je veux laisser un commentaire sur une
séance afin de donner du feedback à l'athlète.*

- \[x\] repositories/activity.repository.ts :
  updateCoachComment(activityId, comment)

- \[x\] app/api/activities/\[id\]/comment/route.ts : PATCH → guard role
  coach (Edge Function update-coach-comment, sync Nolio inclus)

- \[x\] components/sessions/CoachComment.tsx : textarea + save +
  affichage côté athlète (intégré dans ActivityDetailPage)

**US-19** --- *En tant qu'athlète, je veux noter mon ressenti après une
séance afin que mon coach comprenne comment je l'ai vécue.*

- \[ \] repositories/activity.repository.ts :
  updateAthleteFeedback(activityId, rating, text)

- \[ \] app/api/activities/\[id\]/feedback/route.ts : PATCH → guard role
  athlète

- \[ \] components/sessions/AthleteFeedback.tsx : rating 1--5 + textarea

**Jeudi 09/04 · 3h ⚡** *Couches : Service + UI*

**US-20** --- *En tant qu'athlète, je veux voir mes tendances HRV
personnelles afin de comprendre mon état de forme au quotidien.*

- \[x\] services/hrv.service.ts : étendre avec calcul SWC 28j (mean ±
  0.5×SD)

- \[x\] components/charts/AthleteHrvChart.tsx : LnRMSSD sur 30j + zone
  SWC + signal couleur (AthleteTrendsPage avec ReferenceArea SWC)

- \[x\] Filtre : uniquement les données de l'athlète connecté (RLS +
  athlete_id)

**Vendredi 10/04 · 3h ⚡** *Couches : QA*

**US-21** --- *En tant qu'équipe, je veux une suite de tests E2E afin
d'éviter les régressions lors des prochains sprints.*

- \[ \] playwright test : parcours athlète complet (login → calendrier →
  fiche séance → feedback)

- \[ \] playwright test : parcours coach complet (login → dashboard →
  commentaire → HRV)

- \[ \] Polish UI : responsive 375px (iPhone SE), sidebar collapse
  mobile, dark mode optionnel

**🔍 Sprint Review · 30 min**

- \[ \] Démo dual : coach commente une séance → athlète le voit en temps
  réel

- \[ \] Sprint Goal atteint ?

**🔄 Sprint Retrospective · 15 min**

- \[ \] Ce qui a bien marché :

- \[ \] Ce qui peut s'améliorer :

- \[ \] 1 action concrète pour Sprint 5 :

  ------------------------------------------------- ---------------------
  **📅 Sprint 5 --- Module 3 · Fiches Bilan**            13--17 avril **·
                                                                    12h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *L'athlète et le coach disposent d'une fiche bilan semaine/mois avec
> KPIs, heatmap de charge, suivi HRV avec signal d'alarme, et export
> PDF.*
>
> *⚠️ Bloquant : algo signal HRV (Hausse/Dégradation) à recevoir de
> Karoly avant le 13/04*

📝 Sprint Planning · Lundi 13/04 matin · 30 min

- \[ \] Algo HRV reçu de Karoly ? Oui (continuer) / Non (relancer +
  démarrer sans le signal)

- \[ \] Choisir lib PDF : react-pdf (rendu React) ou puppeteer
  (screenshot HTML) ?

**Lundi 13/04 · 2.5h ⚡** *Couches : Service + UI*

**US-22** --- *En tant qu'athlète ou coach, je veux voir mes KPIs
hebdomadaires et mensuels afin de mesurer ma progression.*

- \[ \] repositories/stats.repository.ts : getKpis(athleteId, period)
  --- km, heures, nb séances, répartition sport

- \[ \] services/stats.service.ts : agréger par semaine et mois

- \[ \] components/kpis/KpiCards.tsx : cartes réutilisables (valeur +
  delta vs période précédente)

\[ \] Découplage moyen par sport sur la période (tendance durabilité)

\[ \] RPE moyen déclaré sur la période

\[ \] components/charts/VolumeDistribution.tsx : répartition du volume
par sport (camembert ou barres empilées : % natation / vélo / run)

\[ \] components/charts/LoadEvolution.tsx : évolution de la charge
semaine par semaine (courbe sur 4-8 dernières semaines)

**US-23** --- *En tant que coach, je veux une heatmap calendrier 7j afin
de visualiser la distribution de la charge sur la semaine.*

- \[ \] components/charts/WeeklyHeatmap.tsx : 7 cases colorées par MLS
  normalisé

- \[ \] Légende : vert = faible charge, rouge = charge élevée

**Mardi 14/04 · 2.5h ⚡** *Couches : Service + UI*

**US-24** --- *En tant que coach, je veux voir l'ACWR de chaque athlète
afin d'identifier les risques de blessure.*

- \[ \] services/load.service.ts : computeAcwr(activities\[\]) → charge
  aiguë 7j / charge chronique 28j

\[ \] Détail ACWR --- 3 types de charge à calculer séparément :

--- Charge externe : KM, %CP-CS, Durée

--- Charge interne : RPE, %LT1, %BTW LT1-LT2, %LT2

--- Charge globale : MLS et Durée × RPE

\[ \] Ratio charge aiguë (semaine courante) / charge chronique (4
semaines glissantes) affiché pour chaque type de charge

- \[ \] Alerte si ACWR \> 1.5 (seuil configurable)

- \[ \] components/load/AcwrIndicator.tsx : badge vert/orange/rouge +
  valeur chiffrée

**Acceptance criteria :**

- \[✓\] Calcul ACWR cohérent avec la formule définie (charge interne MLS
  ou externe selon type séance)

- \[✓\] Alerte visible sans avoir à chercher (encart en haut de la
  fiche)

**Mercredi 15/04 · 3h ⚡** *Couches : Service + UI*

**US-25** --- *En tant que coach, je veux un signal HRV
Hausse/Dégradation afin de prendre des décisions d'entraînement fondées
sur l'état de forme réel.*

- \[ \] services/hrv.service.ts : implémenter algo Karoly (signal Hausse
  / Stable / Dégradation)

- \[ \] services/hrv.service.ts : SWC dynamique --- rolling 28j mean ±
  0.5×SD

- \[ \] components/hrv/HrvSignal.tsx : encart coloré vert/jaune/rouge +
  texte explicatif

> *⚠️ Si algo non reçu → implémenter version simplifiée (LnRMSSD vs SWC
> uniquement) et noter la dette*

**Jeudi 16/04 · 2h ⚡** *Couches : Service + UI*

**US-26** --- *En tant que coach, je veux des analyses textuelles
automatiques afin d'avoir une interprétation guidée des données sans
effort.*

- \[ \] services/analysis.service.ts : règles métier → durabilité moy.,
  delta vs période préc., dérive \> 5%

- \[ \] components/analysis/TextInsights.tsx : liste de phrases générées
  par les règles

- \[ \] components/analysis/FocusCoach.tsx : encart rouge si dérive
  cardiaque anormale détectée

**Vendredi 17/04 · 2h ⚡** *Couches : Use Case + Infrastructure*

**US-27** --- *En tant que coach, je veux exporter une fiche bilan en
PDF afin de la partager avec l'athlète ou un sponsor.*

- \[ \] app/api/export/pdf/\[athleteId\]/route.ts : génération PDF côté
  serveur

- \[ \] Contenu : logo KS Endurance, KPIs, graphique HRV, ACWR, analyses
  textuelles

- \[ \] Test export sur 2--3 athlètes réels

**Acceptance criteria :**

- \[✓\] PDF généré en \< 5 secondes

- \[✓\] Mise en page lisible sur A4 imprimé

US-27b --- En tant que coach ou athlète, je veux comparer deux séances
d\'entraînement similaires afin de mesurer la progression sur des
efforts comparables.

\[ \] Bouton \'Comparer une séance similaire\' accessible depuis
n\'importe quelle fiche de séance

\[ \] Le système propose automatiquement les séances du même sport et de
distance comparable (±20%)

\[ \] Sélection de la séance de référence dans un dropdown

\[ \] components/charts/SessionComparisonChart.tsx : courbes superposées
--- allure/puissance et FC sur l\'axe de distance normalisée. Séance
courante en bleu, référence en gris. Profil de dénivelé en arrière-plan
si GPS disponible

\[ \] components/tables/SessionDeltaTable.tsx : tableau côte à côte ---
volume, durée, allure/puissance moy., FC moy., découplage. Delta affiché
avec indicateur +/- coloré (vert = amélioration, rouge = régression)

\[ \] Alerte progression/régression significative : détection
automatique des écarts (ex : \'Allure run améliorée de X% vs séance du
JJ/MM --- signal positif de progression\')

Acceptance criteria :

\[✓\] Seules les séances du même sport et ±20% distance sont proposées

\[✓\] Comparaison fonctionnelle pour les 3 sports (natation, vélo,
course à pied)

**🔍 Sprint Review · 30 min**

- \[ \] Démo : fiche bilan athlète complète → export PDF partageable

- \[ \] Sprint Goal atteint ?

**🔄 Sprint Retrospective · 15 min**

- \[ \] Ce qui a bien marché :

- \[ \] Ce qui peut s'améliorer :

- \[ \] 1 action concrète pour Sprint 6 :

  ------------------------------------------------- ---------------------
  **🚀 Sprint 6 --- Livraison & Recette**           20--24 avril **· 9h**

  ------------------------------------------------- ---------------------

🎯 Sprint Goal

> *Le Lot 1 est recetté par Karoly en conditions réelles, les deux
> espaces (coach + athlète) sont fonctionnels en production, la dette
> technique est documentée.*

📝 Sprint Planning · Lundi 20/04 matin · 30 min

- \[ \] Lister les bugs ouverts depuis S5

- \[ \] Prioriser : bloquants (must fix) vs cosmétiques (nice to have)

- \[ \] Préparer le script de démo pour Karoly (jeudi)

**Lundi 20/04 · 2.5h** *Couches : QA*

- \[ \] Tests globaux cross-rôles : coach + athlète sur données réelles
  prod

- \[ \] Vérification RLS complète (Supabase Studio → logs d'accès)

- \[ \] Correction bugs bloquants identifiés en S5

**Mardi 21/04 · 2h ⚡** *Couches : QA*

**US-28** --- *En tant qu'équipe, je veux une suite de tests E2E finale
afin de garantir la stabilité avant la recette.*

- \[ \] playwright test \--reporter=html : rapport de couverture complet

- \[ \] Parcours coach : login → dashboard → filtre → heatmap →
  reprocess → export PDF

- \[ \] Parcours athlète : login → calendrier → fiche séance → feedback
  → bilan → HRV

**Mercredi 22/04 · 2h** *Couches : QA + Buffer*

- \[ \] Buffer recette : corrections issues de la démo interne (mardi)

- \[ \] Vérification domaine prod, SSL, deploy stable, temps de réponse
  \< 2s

- \[ \] Vérification que le robot d'ingestion tourne toujours
  correctement (CI robot_v8.yml vert)

**Jeudi 23/04 · 1.5h** *Couches : Démo Karoly*

- \[ \] Session live avec Karoly : parcours coach complet + parcours
  athlète

- \[ \] Go / No-Go production

- \[ \] Collecte feedback → créer les tickets pour le Lot 2 (backlog)

**Vendredi 24/04 · 1h** *Couches : Clôture*

**US-29** --- *En tant qu'équipe, je veux une documentation minimale
afin que Karoly puisse gérer l'application en autonomie.*

- \[ \] README.md : architecture, commandes deploy, rotation des secrets

- \[ \] Guide admin : inviter un athlète, gérer les groupes, reprocesser
  une séance

- \[ \] Archiver les scripts de debug (scripts/debug\_\*.py) dans un
  dossier scripts/archive/

**🔍 Sprint Review · 30 min**

- \[ \] Démo prod avec Karoly --- tous les modules fonctionnels

- \[ \] Sprint Goal atteint ?

- \[ \] Backlog Lot 2 alimenté avec le feedback Karoly

**🔄 Sprint Retrospective · 15 min**

- \[ \] Bilan des 6 sprints : vélocité réelle vs estimée

- \[ \] Ce qui a bien marché sur le projet :

- \[ \] Ce qui serait fait différemment dès le départ :

- \[ \] Dette technique à solder en Lot 2 :

**🎉 Jalon 3 --- Facture finale 934 €**

📊 Suivi Vélocité

  ---------------- ------------ ------------ ------------ -----------------
  **Sprint**           **h          **h       **Delta**    **Goal atteint
                    estimées**   réelles**                       ?**

  Sprint 1              9h                                

  Sprint 2             13h                                

  Sprint 3             13h                                

  Sprint 4             17h                                

  Sprint 5             12h                                

  Sprint 6              9h                                

  **Total**          **73h**                              
  ---------------- ------------ ------------ ------------ -----------------

🔖 Légende

⚡ = tâche fortement accélérée par Claude Code (génération, review,
refacto)

⚠️ = dépendance externe (Karoly ou Nolio) --- bloquant potentiel

🎉 = jalon de paiement

**US-XX** = User Story numérotée (traçabilité backlog)

**Couches** = couche(s) Clean Architecture touchée(s) par la tâche
