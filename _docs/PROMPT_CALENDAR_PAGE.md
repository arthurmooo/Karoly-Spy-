# PROMPT — Page Calendrier (`/calendar`)

Ce prompt est un **addendum** au prompt principal (`PROMPT_FRONTEND_AGENT.md`). Il suit le même design system, la même architecture Clean, et les mêmes conventions.

---

## 1. CONCEPT

La page Calendrier est la **vue temporelle** de l'activité d'entraînement. Elle affiche côte à côte :
- Les **séances réalisées** (déjà en DB dans `activities`) — cases colorées par sport
- Les **séances planifiées** (futures, issues de Nolio) — cases en bordure pointillée, fond grisé

Le coach peut naviguer par **semaine**, **mois** ou **année**, filtrer par athlète et par sport, et cliquer sur n'importe quelle séance pour accéder au détail (`/activities/:id`).

---

## 2. SOURCE DE DONNÉES

### Séances réalisées (DB — déjà disponible)

Table `activities` — requête directe :

```ts
supabase
  .from("activities")
  .select("id, athlete_id, session_date, sport_type, work_type, activity_name, duration_sec, distance_m, load_index, avg_hr")
  .gte("session_date", startDate)   // début de la plage visible
  .lte("session_date", endDate)     // fin de la plage visible
  .order("session_date", { ascending: true })
```

Si un athlète est sélectionné, ajouter `.eq("athlete_id", athleteId)`.

Champs clés :
| Champ | Type | Usage |
|-------|------|-------|
| `id` | uuid | Lien vers `/activities/:id` |
| `athlete_id` | uuid | FK vers `athletes` |
| `session_date` | timestamptz | Date de la séance |
| `sport_type` | text | `Run`, `Bike`, `Swim`, `Ski`, `Strength`, `Other` |
| `work_type` | text | `endurance`, `intervals`, `competition` |
| `activity_name` | text | Ex: "Fractionné 6×1000m", "Sortie longue" |
| `duration_sec` | float | Durée en secondes |
| `distance_m` | float | Distance en mètres |
| `load_index` | float | MLS (0-10+) |

### Séances planifiées (futures — table à créer)

> **Note** : Cette table n'existe pas encore en DB. Il faudra la créer (migration Supabase) et ajouter un sync dans le robot d'ingestion backend. En attendant, le frontend doit être **prêt** à consommer ces données dès qu'elles seront disponibles. Utiliser un **flag feature** ou simplement ne rien afficher si la table est vide.

Table future `planned_workouts` :
| Champ | Type | Source Nolio |
|-------|------|-------------|
| `id` | uuid | PK auto |
| `athlete_id` | uuid | FK → athletes |
| `nolio_id` | integer | `nolio_id` du planned |
| `planned_date` | date | `date_start` |
| `sport` | text | Mappé depuis Nolio (Run/Bike/Swim/Ski/Strength) |
| `name` | text | `name` du workout planifié |
| `description` | text | Description textuelle du coach |
| `duration_planned_sec` | float | Durée prévue |
| `distance_planned_m` | float | Distance prévue |
| `structured_workout` | jsonb | Structure complète des intervalles |
| `linked_activity_id` | uuid | FK → activities (si réalisée, NULL si future) |
| `synced_at` | timestamptz | Dernière sync |

Requête :
```ts
supabase
  .from("planned_workouts")
  .select("*")
  .gte("planned_date", startDate)
  .lte("planned_date", endDate)
  .order("planned_date", { ascending: true })
```

### Table `athletes` (pour le filtre)

```ts
supabase
  .from("athletes")
  .select("id, first_name, last_name")
  .eq("is_active", true)
  .order("last_name")
```

---

## 3. ARCHITECTURE (Clean)

```
repositories/
  calendar.repository.ts    → getActivities(range, filters), getPlannedWorkouts(range, filters)

services/
  calendar.service.ts       → groupByDay(activities), groupByWeek(), mergeRealizedAndPlanned()

hooks/
  useCalendar.ts            → date range state, view mode, filters, merged data

components/
  calendar/
    CalendarGrid.tsx         → Grille jour/semaine/mois (le composant principal)
    CalendarCell.tsx          → Une cellule = un jour avec ses séances
    CalendarEvent.tsx         → Un événement (réalisé ou planifié) dans une cellule
    CalendarHeader.tsx        → Navigation mois/semaine + contrôles
    CalendarLegend.tsx        → Légende couleurs sport
  filters/
    CalendarFilters.tsx       → Athlète + sport + vue

pages/
  CalendarPage.tsx           → Compose tout
```

---

## 4. LAYOUT & DESIGN

### Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│  calendar_month  Calendrier d'Entraînement                              │
│  "Planification et suivi des séances"                    [filtres]      │
│                                                                          │
│  [◀ Précédent]  [Semaine ▪ Mois ▪ Année]  [Suivant ▶]   Mars 2026      │
└──────────────────────────────────────────────────────────────────────────┘
```

- H1 : `"Calendrier d'Entraînement"` — `text-3xl font-extrabold text-primary`
- Sous-titre : `"Planification et suivi des séances"` — `text-sm text-slate-500`
- Navigation temporelle : boutons `chevron_left` / `chevron_right` + label mois/année central
- Toggle vue : 3 boutons `"Semaine"` | `"Mois"` | `"Année"` — actif = `bg-primary text-white`, inactif = `bg-white border border-slate-200`

### Filtres (ligne sous le header)

```
[Dropdown Athlète ▼]  [Dropdown Sport ▼]  [Bouton "Aujourd'hui"]
```

- Dropdown **Athlète** : `"Tous les athlètes"` (défaut) + liste triée par nom. Si un athlète est sélectionné, le calendrier ne montre que ses séances.
- Dropdown **Sport** : `"Tous les sports"` + `"Course à pied"`, `"Vélo"`, `"Natation"`, `"Ski"`, `"Musculation"`
- Bouton **Aujourd'hui** : ramène la vue à la date du jour — `bg-accent-orange text-white px-3 py-1.5 rounded-lg text-sm font-semibold`

---

## 5. VUE MOIS (vue par défaut)

### Grille

```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Lundi  │  Mardi  │ Mercredi│  Jeudi  │ Vendredi│  Samedi │ Dimanche│
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│    1    │    2    │    3    │    4    │    5    │    6    │    7    │
│ ●Run    │         │ ●Bike   │ ●Run    │         │ ●Bike   │ ○Run    │
│ ●Swim   │         │         │ ●Swim   │         │         │         │
│         │         │         │         │         │         │         │
├─────────┤ ...     │ ...     │ ...     │ ...     │ ...     │ ...     │
│    8    │         │         │         │         │         │         │
│ ...     │         │         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

● = séance réalisée (fond coloré par sport)
○ = séance planifiée (bordure pointillée, fond gris clair)
```

**Cellule jour** (`CalendarCell`) :
- Taille : hauteur minimale `h-28` (desktop), `h-16` (mobile)
- Numéro du jour : `text-xs font-semibold` en haut à droite
- Jour courant : numéro dans un cercle `bg-accent-orange text-white rounded-full w-6 h-6`
- Jours hors mois courant : `opacity-30`
- Hover : `bg-slate-50 dark:bg-slate-800/50`
- Max 3 événements visibles, puis `"+X autres"` en `text-xs text-primary cursor-pointer` (click → ouvre un popover listant tous les événements du jour)

**Événement réalisé** (`CalendarEvent`) :
```
[icône sport] [nom séance tronqué]
```
- Fond : couleur du sport à 10% d'opacité
  - Run : `bg-accent-orange/10 text-accent-orange`
  - Bike : `bg-accent-blue/10 text-accent-blue`
  - Swim : `bg-teal-500/10 text-teal-600`
  - Ski : `bg-violet-500/10 text-violet-600`
  - Strength : `bg-slate-200 text-slate-600`
- Border gauche : `border-l-2` couleur du sport (plein)
- Texte : `text-[11px] font-medium truncate`
- Icône sport : `text-xs` Material Symbol (`directions_run`, `directions_bike`, `pool`, `downhill_skiing`, `fitness_center`)
- Click → navigate `/activities/:id`

**Événement planifié** (non encore réalisé) :
- Même structure mais :
  - Fond : `bg-slate-100/50 dark:bg-slate-800/30`
  - Border gauche : `border-l-2 border-dashed` couleur du sport à 40% opacité
  - Texte : `text-slate-400 italic`
  - Icône : même mais `opacity-40`
  - PAS cliquable (pas d'activity_id)
  - Si l'événement planifié a un `linked_activity_id` (= réalisé), ne PAS l'afficher (éviter doublon)

**Hover tooltip sur événement** :
```
┌─────────────────────────────┐
│  Course à pied              │
│  Fractionné 6×1000m         │
│  ─────────────────────────  │
│  Durée: 1h12                │
│  Distance: 16.4 km          │
│  MLS: 78                    │
│  FC moy: 148 bpm            │
└─────────────────────────────┘
```
- Fond : `bg-white dark:bg-slate-900 shadow-lg rounded-lg p-3 border border-slate-200`
- Titre sport : `text-xs font-bold uppercase text-slate-500`
- Nom séance : `text-sm font-semibold`
- Métriques : `text-xs text-slate-500` avec valeurs en `font-mono`
- Afficher MLS avec le badge coloré (cf. `MLS_LEVEL` dans constants.ts)

---

## 6. VUE SEMAINE

Grille 7 colonnes (Lundi → Dimanche), **une seule ligne** de hauteur pleine.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Lun 3   │  Mar 4   │  Mer 5   │  Jeu 6   │  Ven 7   │  Sam 8   │  Dim 9   │
│          │          │          │          │          │          │          │
│ ┌──────┐ │          │ ┌──────┐ │ ┌──────┐ │          │ ┌──────┐ │          │
│ │ Run  │ │          │ │ Bike │ │ │ Run  │ │          │ │ Bike │ │          │
│ │Fract.│ │          │ │Sort. │ │ │End.  │ │          │ │Comp. │ │          │
│ │1h12  │ │          │ │longu.│ │ │45min │ │          │ │3h20  │ │          │
│ │16.4km│ │          │ │85km  │ │ │8.2km │ │          │ │120km │ │          │
│ │MLS:78│ │          │ │MLS:45│ │ │MLS:22│ │          │ │MLS:65│ │          │
│ └──────┘ │          │ └──────┘ │ └──────┘ │          │ └──────┘ │          │
│          │          │          │          │          │          │          │
│ ┌──────┐ │          │          │ ┌──────┐ │          │          │          │
│ │ Swim │ │          │          │ │ Swim │ │          │          │          │
│ │Tech. │ │          │          │ │End.  │ │          │          │          │
│ │45min │ │          │          │ │1h00  │ │          │          │          │
│ └──────┘ │          │          │ └──────┘ │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

Chaque événement = **card** plus détaillée :
- `bg-white dark:bg-slate-900 rounded-lg border shadow-sm p-3 mb-2`
- Border gauche : `border-l-4` couleur sport
- Contenu :
  - Ligne 1 : `[icône sport] [Sport label]` — `text-[10px] font-bold uppercase tracking-wide` + couleur sport
  - Ligne 2 : `[activity_name]` — `text-sm font-semibold truncate`
  - Ligne 3 : `[durée formatée]` — `text-xs text-slate-500 font-mono`
  - Ligne 4 : `[distance formatée]` — `text-xs text-slate-500 font-mono`
  - Ligne 5 : `MLS: [badge coloré]` — cf. badge MLS du prompt principal

Header de colonne :
- `[Jour abrégé] [numéro]` — ex: `"Lun 3"`
- Jour courant : fond `bg-accent-orange/10`, texte `text-accent-orange font-bold`
- Hauteur colonne : `min-h-[400px]` (desktop) pour avoir de l'espace

---

## 7. VUE ANNÉE

Grille 12 mois (4 colonnes × 3 lignes), chaque mois = mini-calendrier à la GitHub contribution graph.

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│   Janvier 2026   │   Février 2026   │    Mars 2026     │    Avril 2026    │
│  L M M J V S D   │  L M M J V S D   │  L M M J V S D   │  L M M J V S D  │
│  . . . 1 2 3 4   │  . . . . . . 1   │  . . . . . . 1   │  . . . 1 2 3 4  │
│  5 ■ . ■ . ■ .   │  2 ■ . . ■ . .   │  2 ■ ■ . ■ . ■   │  ...            │
│  . . ■ . ■ . .   │  ...             │  ...             │                  │
│  ...             │                  │                  │                  │
├──────────────────┤ ...              │ ...              │ ...              │
│   Mai 2026       │                  │                  │                  │
│   ...            │                  │                  │                  │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

Chaque jour = un **petit carré** (comme les contribution graphs GitHub) :
- Taille : `w-3 h-3 rounded-sm`
- Couleur :
  - Pas de séance : `bg-slate-100 dark:bg-slate-800`
  - 1 séance : couleur du sport à 40% — `bg-accent-orange/40` (Run), `bg-accent-blue/40` (Bike), etc.
  - 2+ séances : couleur du sport pleine — `bg-accent-orange` (Run), `bg-accent-blue` (Bike)
  - Si multi-sport dans la même journée : utiliser le sport dominant (le plus long en durée), ou afficher un dégradé diagonal
- Hover tooltip : `"3 mars — 2 séances (Run + Swim) — MLS total: 5.8"`
- Click : zoom vers vue semaine de cette date

Titre du mois : `text-sm font-bold text-primary`
Labels jours : `text-[9px] text-slate-400` — `L M M J V S D`

---

## 8. STATS RÉSUMÉ (bas de page, toutes vues)

Bande de statistiques sous le calendrier (responsive 4 colonnes desktop, 2 mobile) :

```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│ Séances        │ Volume         │ Distance       │ MLS moyen      │
│ 24             │ 32h 15m        │ 412 km         │ 3.8            │
│ cette période  │ cette période  │ cette période  │ cette période  │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

Données calculées dynamiquement à partir des activités de la plage visible :
- **Séances** : COUNT des activités
- **Volume** : SUM `duration_sec` formaté en `Xh XXm`
- **Distance** : SUM `distance_m` formaté en `XXX km`
- **MLS moyen** : AVG `load_index` arrondi à 1 décimale

Utiliser le composant `MetricCard` du design system (cf. prompt principal).

---

## 9. RESPONSIVE (mobile 375px)

### Vue Mois mobile
- Grille compressée : chaque cellule montre juste le **numéro du jour** + **dots colorés** (1 dot = 1 séance, couleur = sport)
- Max 3 dots par cellule, pas de texte
- Tap sur un jour → ouvre un **bottom sheet** / slide-up panel listant les séances du jour avec cards détaillées

### Vue Semaine mobile
- Scroll horizontal (swipe) sur les 7 jours
- 1 colonne visible à la fois, swipe pour naviguer
- Cards séances identiques au desktop

### Filtres mobile
- Cachés derrière un bouton `"filter_list Filtres"` (icône Material Symbol)
- Ouvre un slide-down panel avec les dropdowns empilés

---

## 10. INTERACTIONS

### Navigation
- `chevron_left` / `chevron_right` changent la période (semaine/mois/année selon la vue active)
- Toggle `Semaine | Mois | Année` change le mode de vue (persister dans URL search params : `?view=month&date=2026-03`)
- Bouton `"Aujourd'hui"` : recentre sur la date courante

### Click séance réalisée
- Navigate vers `/activities/:id`

### Click jour (vue mois)
- Si 1 séance : navigate directement vers `/activities/:id`
- Si 2+ séances : ouvre un popover/panel listant les séances du jour
- Si 0 séance : rien (ou passer en vue semaine centrée sur ce jour)

### Keyboard
- `←` / `→` : période précédente/suivante
- `T` : retour à aujourd'hui
- `1` / `2` / `3` : switch vue Semaine / Mois / Année

---

## 11. ROUTING & NAVIGATION

```tsx
// Dans App.tsx, ajouter :
<Route path="/calendar" element={<CalendarPage />} />
```

Sidebar navigation — ajouter l'item :
```
calendar_month → "Calendrier" → /calendar
```

Position dans la sidebar : entre `"Séances"` et `"Analytique"` (4ème position).

URL search params pour état persisté :
```
/calendar?view=month&date=2026-03&athlete=uuid&sport=Run
```

---

## 12. HOOK `useCalendar`

```ts
interface CalendarState {
  view: "week" | "month" | "year";
  currentDate: Date;             // date de référence pour la navigation
  selectedAthleteId: string | null;
  selectedSport: string | null;
}

interface CalendarData {
  activities: Activity[];         // séances réalisées dans la plage
  plannedWorkouts: PlannedWorkout[];  // séances planifiées (si table existe)
  stats: {
    totalSessions: number;
    totalDurationSec: number;
    totalDistanceM: number;
    avgMls: number;
  };
  isLoading: boolean;
}

// Le hook calcule automatiquement startDate/endDate selon view + currentDate
// et fetch les données correspondantes
```

---

## 13. TYPES

```ts
// types/calendar.ts

interface CalendarEvent {
  id: string;
  date: Date;
  type: "realized" | "planned";
  sport: string;                // Run, Bike, Swim, Ski, Strength, Other
  name: string;                 // activity_name ou planned name
  workType?: string;            // endurance, intervals, competition
  durationSec?: number;
  distanceM?: number;
  mls?: number;
  avgHr?: number;
  athleteId: string;
  athleteName: string;
  activityId?: string;          // null si planifié non réalisé
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}
```

---

## 14. PERFORMANCE

- **Ne PAS charger toutes les activités d'un coup**. Charger uniquement la plage visible :
  - Vue semaine : 7 jours
  - Vue mois : ~35 jours (5 semaines affichées)
  - Vue année : 365 jours (attention, peut contenir ~4000+ activités pour 60 athlètes — paginer ou grouper)
- Vue année sans filtre athlète : **grouper côté DB** avec une requête agrégée :
  ```ts
  supabase.rpc("calendar_year_summary", { year: 2026 })
  // Retourne: { date, sport_type, count, total_duration, total_distance, avg_mls }
  ```
  (Il faudra créer cette RPC côté backend si les perf le nécessitent. En attendant, un `.select()` avec limit 5000 peut suffire.)
- **Debounce** les changements de filtre (300ms) pour éviter les requêtes en rafale.
- Cache les données déjà chargées (ex: si on navigue mois précédent puis revient, ne pas re-fetch).
