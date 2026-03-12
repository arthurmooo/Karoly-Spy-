# PROMPT AGENT FRONTEND — PROJECT K (KS ENDURANCE TRAINING)

---

## 0. CONTEXTE GLOBAL

Tu dois construire **l'intégralité du frontend** d'une plateforme de coaching triathlon appelée **Project K**, destinée au coach **Karoly Spy** et ses ~60 athlètes.

Le backend (Python + Supabase PostgreSQL) est 100% opérationnel. Ton unique rôle est de construire l'interface web. Aucun changement côté backend n'est requis.

---

## 1. STACK TECHNIQUE OBLIGATOIRE

```
Vite 6 + React 19 + TypeScript 5 (strict)
React Router DOM v7 (SPA routing)
Tailwind CSS v4 (@tailwindcss/vite plugin)
@supabase/supabase-js v2
Recharts v2 (graphiques)
clsx + tailwind-merge (className utils)
```

**Setup Vite:**
```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

**tsconfig.json** — strict mode ON, paths `@/*` → `src/*`, `noEmit: true`.

---

## 2. DESIGN SYSTEM (SOURCE DE VÉRITÉ ABSOLUE)

### 2.1 Tokens CSS (dans `src/index.css`)

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-primary: #240066;
  --color-primary-light: #3a0099;
  --color-accent-orange: #f97316;
  --color-accent-green: #0bda6f;
  --color-accent-blue: #3b82f6;
  --color-bg-light: #f6f5f8;
  --color-bg-dark: #160f23;
  --color-card-dark: #2e273a;
  --font-sans: "Lexend", sans-serif;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg-light);
}

.dark body {
  background-color: var(--color-bg-dark);
}
```

### 2.2 Fonts (dans `index.html`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
  rel="stylesheet"
/>
```

**Toutes les icônes** sont des `<span className="material-symbols-outlined">nom_icone</span>`.

### 2.3 Palette de couleurs

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#240066` | Sidebar, headers, boutons principaux, icônes structurelles |
| Accent Orange | `#f97316` | CTAs, badges actifs, highlights, bordures gauche |
| Accent Green | `#0bda6f` | Tendances positives, statuts OK |
| Accent Blue | `#3b82f6` | FC/cardio dans graphiques, liens |
| BG Light | `#f6f5f8` | Fond page light mode |
| BG Dark | `#160f23` | Fond page dark mode |
| Card Dark | `#2e273a` | Surface cards dark mode |
| White | `#ffffff` | Cards light mode |

**Heatmap (5 niveaux MLS):**
- Level 0 (repos): `#f1f5f9`
- Level 1 (faible): `#bfdbfe`
- Level 2 (modéré): `#60a5fa`
- Level 3 (élevé): `#f97316`
- Level 4 (critique): `#ea580c`

### 2.4 Typographie

- Font family: **Lexend** partout
- Titres page H1: `text-3xl font-extrabold` ou `text-4xl font-black`
- Titres sections H2/H3: `text-xl font-bold` + icône Material Symbols
- Labels métriques: `text-[10px] font-bold uppercase tracking-widest text-slate-500`
- Valeurs métriques KPI: `text-2xl font-black` ou `text-3xl font-bold`
- Corps texte: `text-sm font-medium`
- Données numériques: `font-mono`

### 2.5 Composants UI standards

**Card:**
```
bg-white dark:bg-slate-900
border border-slate-200 dark:border-slate-800
rounded-xl shadow-sm p-5 ou p-6
```

**Card avec accent gauche (KPI important):**
```
+ border-l-4 border-l-accent-orange (ou border-l-accent-blue)
```

**Badge/chip:**
```
inline-flex items-center px-2.5 py-0.5 rounded-full
text-[10px] font-bold uppercase tracking-wide
```
Variants:
- Primary: `bg-primary/10 text-primary`
- Orange: `bg-accent-orange/10 text-accent-orange`
- Green: `bg-accent-green/10 text-accent-green`
- Slate: `bg-slate-100 text-slate-600`

**Bouton primaire:**
```
bg-primary hover:bg-primary-light text-white
px-4 py-2.5 rounded-lg text-sm font-semibold
flex items-center gap-2 transition-opacity
```

**Bouton secondaire:**
```
border border-slate-200 dark:border-slate-700
bg-white dark:bg-slate-800 hover:bg-slate-50
px-4 py-2.5 rounded-lg text-sm font-medium
```

**Input:**
```
w-full bg-slate-50 dark:bg-slate-800
border border-slate-200 dark:border-slate-700
rounded-lg px-4 py-3 text-sm
focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
placeholder:text-slate-400
```

**Table:**
```
Header: bg-primary text-white text-[11px] font-bold uppercase tracking-wide px-4 py-3
Row: hover:bg-primary/5 dark:hover:bg-primary/10 border-b border-slate-100 dark:border-slate-800
Cell: text-sm px-4 py-3
```

**Sidebar (w-64 = 256px):**
```
bg-white dark:bg-slate-900
border-r border-slate-200 dark:border-slate-800
h-screen sticky top-0 flex flex-col
```

**Nav item sidebar:**
- Inactif: `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50`
- Actif: `bg-primary/10 text-primary font-semibold border-r-2 border-accent-orange`

---

## 3. ARCHITECTURE (CLEAN — OBLIGATOIRE)

```
web/src/
├── types/
│   ├── database.ts       # Types générés Supabase (voir section 6)
│   ├── activity.ts       # Types domaine activités
│   ├── athlete.ts        # Types domaine athlètes
│   ├── physio.ts         # Types profils physio
│   ├── readiness.ts      # Types HRV/biométrie
│   └── filters.ts        # Types filtres/pagination
├── repositories/
│   ├── activity.repository.ts
│   ├── athlete.repository.ts
│   ├── physio.repository.ts
│   ├── readiness.repository.ts
│   └── load.repository.ts
├── services/
│   ├── format.service.ts    # speedToPace, formatDuration, formatDistance
│   ├── activity.service.ts  # map raw → domain
│   ├── load.service.ts      # MLS normalisation, ACWR
│   ├── hrv.service.ts       # parse CSV HRV4Training, rolling avg
│   └── analysis.service.ts  # text insights, alerts
├── hooks/
│   ├── useAuth.ts
│   ├── useTheme.ts
│   ├── useActivities.ts
│   ├── useAthletes.ts
│   ├── usePhysio.ts
│   ├── useReadiness.ts
│   ├── useLoad.ts
│   └── useFilters.ts
├── components/
│   ├── ui/               # Button, Badge, Card, Input, Select, Icon, Table
│   ├── layout/           # Sidebar, Header, CoachLayout, MobileNav
│   ├── filters/          # ActivityFilters, DateRangePicker, SportFilter
│   ├── tables/           # ActivityTable, IntervalTable, PhysioHistory
│   ├── charts/           # FleetHeatmap, DecouplingChart, HrvChart, PerformanceChart
│   ├── sessions/         # CoachComment, AthleteFeedback, ManualIntervalDetector
│   └── kpis/             # MetricCard, KpiCards, AcwrIndicator
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── ActivitiesPage.tsx
│   ├── ActivityDetailPage.tsx
│   ├── ProfilesPage.tsx
│   ├── HealthPage.tsx
│   └── AthleteTrendsPage.tsx
├── lib/
│   ├── supabase.ts       # createClient
│   ├── cn.ts             # clsx + twMerge
│   └── constants.ts      # SPORTS, ZONE_COLORS, HEATMAP_THRESHOLDS
├── App.tsx               # Routes
├── main.tsx
└── index.css
```

**RÈGLE ABSOLUE**: Les `components/` n'importent JAMAIS depuis `repositories/`. Flow: `repository → service → hook → page/component`.

---

## 4. AUTH & ROUTING

### 4.1 Supabase Client (`src/lib/supabase.ts`)
```ts
import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(url, key);
```

### 4.2 Auth hook (`src/hooks/useAuth.ts`)
- `signIn(email, password)` via `supabase.auth.signInWithPassword`
- `signOut()` via `supabase.auth.signOut`
- `session`, `user`, `loading`, `role` (depuis `user_profiles` table)
- Role query: `SELECT role FROM user_profiles WHERE id = auth.uid()`

### 4.3 Routes (`src/App.tsx`)
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<CoachLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/activities" element={<ActivitiesPage />} />
      <Route path="/activities/:id" element={<ActivityDetailPage />} />
      <Route path="/profiles" element={<ProfilesPage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="/athletes/:id/trends" element={<AthleteTrendsPage />} />
    </Route>
  </Route>
</Routes>
```

`ProtectedRoute`: si pas de session → redirect `/login`.

---

## 5. PAGES — DESCRIPTION DÉTAILLÉE

### PAGE 1: `/login` — LoginPage

**Layout**: page centrée verticalement et horizontalement, fond `#f6f5f8`.

**Contenu:**

**Logo section (centré, au-dessus de la card):**
- Boîte `bg-primary` 64×64px, `rounded-2xl`, `shadow-lg shadow-primary/20`
- Icône Material Symbol: `directions_run` (FILL: 1), `text-4xl text-white`
- Titre: `"KS ENDURANCE TRAINING"` — `text-2xl font-black uppercase` — `text-primary`
- Sous-titre: `"Plateforme de coaching premium pour triathlètes"` — `text-sm text-slate-500`

**Login Card** (`max-w-[440px] w-full mx-auto`):
- Background: `bg-white dark:bg-slate-900`
- Border: `border border-slate-200 dark:border-slate-800`
- `rounded-xl shadow-sm p-8`

Champs du formulaire:
1. **Email**: label `"E-mail"`, icône `mail` absolute left, input avec `pl-10`
2. **Mot de passe**: label `"Mot de passe"` + lien `"Oublié ?"` right-aligned en `text-xs text-primary`, icône `lock` absolute left, bouton visibility toggle `visibility/visibility_off` absolute right

**Alerte erreur** (conditionnelle):
- `bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2`
- Icône `error text-red-500`
- Texte: `"Identifiants incorrects. Veuillez réessayer."`

**Bouton submit:**
- `w-full bg-accent-orange hover:bg-orange-600 text-white py-4 rounded-lg font-semibold`
- `shadow-md shadow-accent-orange/20`
- Contenu: `"Se connecter"` + icône `arrow_forward`
- État loading: spinner (icône `refresh` animate-spin)

**Footer card**: `"Nouveau sur la plateforme ? Demander un accès coach"` — `text-xs text-center text-slate-400 mt-4`

**Décorations visuelles** (bas de page, opacité 40%):
- 3 colonnes: `[analytics + "Analytics"]`, `[timer + "Performance"]`, `[query_stats + "Data-Driven"]`

---

### PAGE 2: `/activities` — ActivitiesPage

**Layout**: CoachLayout (sidebar gauche w-64 + main content)

**Header de page:**
- Breadcrumb: `"Accueil"` > `"Journal d'Activités"` (chevron_right entre les deux)
- H1: `"Journal d'Activités"` — `text-3xl font-extrabold text-primary`
- Description: `"Gérez et analysez les performances de vos athlètes en temps réel."` — `text-sm text-slate-500`
- Boutons droite: `"Exporter CSV"` (secondary, icône `download`) + `"Nouvelle Activité"` (primary, icône `add`)

**Barre de filtres** (grid 4 colonnes):
1. Dropdown **Athlète**: liste des athlètes depuis `athletes` table (triés par `last_name`)
2. Dropdown **Sport**: options: `"Tous les sports"`, `"Course à pied"`, `"Vélo"`, `"Natation"`, `"Trail"`, `"Triathlon"`, `"Ski de fond"`, `"Musculation"`
3. Input **Date**: type date (format `YYYY-MM-DD`)
4. Input **Recherche**: placeholder `"Rechercher une séance..."`, icône `search` left

**Tableau d'activités** (source: `view_athlete_monitoring_karo`):

Colonnes:
| Colonne | Champ DB | Format |
|---------|----------|--------|
| Date | `Date` | `dd MMM yyyy` |
| Athlète | `athlete` | Avatar initiales + nom |
| Sport | `Sport` | Icône sport + label |
| Type | `Type` | Badge coloré |
| Durée | `Durée` | `HH:mm:ss` |
| Distance | `KM` | `X.XX km` |
| MLS | `MLS` | Badge numérique coloré |
| FC Moy | `Hr Séance` | `XXX bpm` |
| Allure / Puissance | `Allure Moy` ou `PmoyW` | selon sport |

**Icônes sport** (Material Symbols):
- `"CAP"` / `"Course"` → `directions_run` (orange)
- `"VELO"` / `"Vélo"` → `directions_bike` (bleu)
- `"NAT"` / `"Natation"` → `pool` (teal)
- `"SKI"` → `downhill_skiing` (violet)
- `"TRI"` / `"Triathlon"` → `directions_run` (gradient)

**Badge MLS:**
- 0-3: `bg-emerald-100 text-emerald-700`
- 3-5: `bg-amber-100 text-amber-700`
- 5-7: `bg-orange-100 text-orange-700`
- 7+: `bg-red-100 text-red-700`

**Badge Type:**
- `"Compétition"` → `bg-accent-orange/10 text-accent-orange`
- `"Endurance"` → `bg-primary/10 text-primary`
- `"Fractionné"` / `"Intervalles"` → `bg-slate-100 text-slate-600`

Chaque ligne est **cliquable** → navigate `/activities/:id` (utiliser `activity_id`).

**Pagination:**
- Affichage: `"Affichage de X à Y sur Z activités"`
- Boutons: `chevron_left` | pages numériques | `chevron_right`
- `pageSize = 20`, query avec `.range(from, to)` sur Supabase

**Statistiques en bas** (4 colonnes):
1. **Distance Totale (semaine)**: somme `KM` 7 derniers jours + delta vs semaine précédente
2. **MLS Moyen**: moyenne `MLS` période filtrée
3. **Volume**: somme durées formatée en `Xh YYm`
4. **Score de Récupération**: stat calculée (si dispo dans `daily_readiness`) ou `--`

---

### PAGE 3: `/dashboard` — DashboardPage

**Layout**: CoachLayout + sidebar avec navigation coach

**Sidebar navigation** (items dans l'ordre):
- `dashboard` → `"Tableau de bord"` (actif ici)
- `groups` → `"Athlètes"`
- `exercise` → `"Séances"` (pointe vers `/activities`)
- `calendar_month` → `"Calendrier"`
- `monitoring` → `"Analytique"` (pointe vers `/health`)

**Header:**
- Breadcrumb: `"/ Vue d'ensemble"`
- Input recherche: `"Rechercher un athlète..."` (icône `search`)
- Bouton notif: cloche avec point orange si alertes
- Bouton `"Nouvelle séance"` (primary)

**KPI Cards** (grille 3 colonnes):

1. **Athlètes actifs**
   - Valeur: COUNT `athletes` WHERE `is_active = true`
   - Icône: `trending_up` vert + delta (ex: `+2 ce mois`)

2. **Séances cette semaine**
   - Valeur: COUNT `activities` WHERE `session_date >= lundi de la semaine courante`
   - Icône: `trending_up` vert + `"+XX%"`

3. **Alertes critiques**
   - Valeur: nombre d'alertes (MLS > 7 ou rMSSD baisse > 10%)
   - Badge `"URGENT"` en `bg-accent-orange/10 text-accent-orange`

**Section principale: Heatmap MLS** (priorité visuelle)

Titre: `"Analyse de la Charge MLS (12 dernières semaines)"` + icône `monitoring`

**Onglets de groupe** (tabs):
- `"TOUS"` | `"GROUPE A"` | `"GROUPE B"` — actif = `bg-white shadow-sm rounded-lg`

**Heatmap** (source: `view_weekly_monitoring`):
- Lignes = athlètes (triés par `athlete`)
- Colonnes = 12 semaines (de la plus ancienne à gauche à la semaine courante à droite)
- Chaque cellule = `mls_hebdo` de l'athlète pour cette semaine
- Couleur selon niveau:
  - `null` / 0 → `#f1f5f9` (repos/pas de données)
  - `mls < 3` → `#bfdbfe` (faible)
  - `3 ≤ mls < 5` → `#60a5fa` (modéré)
  - `5 ≤ mls < 7` → `#f97316` (élevé)
  - `mls ≥ 7` → `#ea580c` (critique)
- Colonne "semaine courante" → `ring-2 ring-primary ring-offset-1` sur cellule
- Hover sur cellule → tooltip: `"Semaine du XX/XX — MLS: X.X — X séances"` (données: `mls_hebdo`, `nb_seances`)
- Chaque ligne commence par: avatar (initiales) + nom athlète (`w-32` fixe)

**Légende** sous heatmap: 5 carrés colorés + labels `"Repos → Critique"`

**Colonne droite:**

**Section Alertes** (`view_health_radar` ou calcul):
- Titre: `"Alertes d'attention"` + lien `"Tout voir"`
- Chaque alerte:
  ```
  [avatar athlète] [nom + description alerte] [badge type]
  ```
  Badges: `"RECUP"` (orange), `"CHARGE"` (bleu), `"URGENT"` (rouge)
- Conditions d'alerte:
  - rMSSD baisse > 10% vs 30d avg → `"RECUP"`
  - MLS hebdo > 7 → `"CHARGE"`
  - Les deux → `"URGENT"`

**Section Activité récente** (`view_live_flux`):
- Titre: `"Activité récente"` + onglets: `"TOUT"` | `"NAT"` | `"VELO"` | `"CAP"`
- Chaque ligne: `[icône sport] [nom athlète] [durée] [badge MLS]`

---

### PAGE 4: `/activities/:id` — ActivityDetailPage

**Layout**: 2/3 gauche (analyse) + 1/3 droite (sidebar actions)

**Source de données**: `activities` JOIN `activity_intervals` + `athletes` + `physio_profiles`

**Header de page:**
- Lien retour: `"← Activités"` (pointe vers `/activities`)
- H1: `"[Sport] : [activity_name]"` — ex: `"Course à pied : Fractionné"`
- Métadonnées: `[Nom athlète]` + `[session_date formatée dd/MM/yyyy]`
- Badge work_type: `"Entraînement"` ou `"Compétition"`

**KPI Cards** (grille 5 colonnes):

| Carte | Champ | Format | Accentuation |
|-------|-------|--------|--------------|
| Durée | `duration_sec` | `H:mm:ss` | Neutre |
| Distance | `distance_m` | `XX.X km` | Neutre |
| MLS | `load_index` | Entier | Neutre |
| FC Moy | `avg_hr` | `XXX bpm` | `border-l-4 border-l-accent-blue` |
| Allure Moy | calculé depuis `interval_pace_mean` ou view | `X'XX /km` | `border-l-4 border-l-accent-orange`, valeur en orange |

**Section: Analyse de la performance** (Recharts)

Toggle: `"Fréquence Cardiaque"` (point bleu) | `"Allure"` (point orange)

Graphique dual-axis (Recharts `ComposedChart`):
- **Ligne FC** (`avg_hr` par interval/temps) : bleue `#3b82f6`
- **Ligne Allure** : orange `#f97316` en dashed
- Fond: alternance légère de zones claires/foncées pour les blocs d'intervalles
- Axe X: timestamps (minutes)
- Axe Y gauche: FC (bpm)
- Axe Y droit: Allure (min/km inversé — plus lent = plus haut)

**Table des intervalles** (source: `activity_intervals`):

Colonnes: `Bloc` | `Distance` | `Temps` | `Allure` | `FC Moy`

Données:
- Lignes `type = "work"` → `bg-accent-orange/5 font-semibold` (mise en valeur orange)
- Lignes `type = "rest"` ou `type = "warmup"` → fond normal
- `avg_speed` (m/s) → pace: `1000 / (avg_speed * 60)` → format `X'XX"`
- `avg_hr` → `XXX bpm`
- `duration` → `mm:ss`

**Badge "Détection"** sous la table: `"Source: [interval_detection_source]"` (plan / lap / algo)

**Section: Carte de localisation** (optionnel):
- Placeholder image avec overlay dégradé
- Badge: `"location_on [Lieu]"` (champ `Lieu` de la view)

---

**Sidebar droite (1/3):**

**1. Détecteur Manuel d'Intervalles** (icône `radar`):
```
Titre: "Détecteur Manuel"
- Label "Fréquence" + input numérique (nb de répétitions)
- Label "Type de valeur" + select: "FC | Allure | Puissance"
- Label "Valeur par segment" + input numérique
- Label "Unité" + select: "Mètres | Secondes | Watts"
- Bouton [analytics] "Lancer l'analyse" (primary full-width)
  → PATCH activity avec manual_interval_* fields
```

**2. Feedback Athlète** (icône `person`):
```
Titre: "Feedback Athlète"
- "Ressenti de l'effort (RPE)" label
- Valeur RPE: "[X]/10" en text-3xl font-black text-primary
- Barre visuelle: 10 cercles (X remplis en accent-orange, reste en slate-200)
- Commentaire athlète: textarea readonly en bg-slate-50, italic
  → Source: activities.rpe
```

**3. Commentaire Coach** (icône `comment`):
```
Titre: "Notes du Coach"
- Textarea: placeholder "Écrire un feedback à l'athlète..."
- Bouton [send] "Envoyer" (primary)
```

---

### PAGE 5: `/profiles` — ProfilesPage

**Source de données**: `physio_profiles` (SCD Type 2 — `valid_to IS NULL` = actif)

**Header:**
- H1: `"Profils de Performance"` — `text-4xl font-black`
- Description: `"Suivi des seuils métaboliques, FTP et zones de fréquence cardiaque."`
- Dropdown athlète: permet de sélectionner un athlète (tous si coach)

**Grille principale (2 colonnes: Vélo | Course)**

**Colonne Vélo** (sport = `"VELO"` dans `physio_profiles`):

**Profil actif** (`valid_to IS NULL`):
- Card avec `border-l-4 border-accent-orange`
- Header: titre `"Profil de Saison"` + date `"Dernier test : [valid_from formaté]"` + badge `"ACTIF"` orange
- Grid 2×2 métriques:
  - **CP/FTP**: `cp_cs` W + `cp_cs/weight` W/kg
  - **CP Montée**: `cp_montee` W (si renseigné)
  - **FC LT1**: `lt1_hr` bpm + label `"Aérobie"`
  - **FC LT2**: `lt2_hr` bpm + label `"Anaérobie"`

**Profils archivés** (valid_to IS NOT NULL, max 3 affichés):
- Card semi-transparente `bg-white/60 opacity-75`
- Icône `history` + nom + plage de dates `[valid_from → valid_to]`
- Valeur principale + badge `"ARCHIVÉ"` slate

**Formulaire ajout profil Vélo:**
- Card `border-2 border-dashed border-slate-200 hover:border-primary`
- Titre: `add_circle` + `"Ajouter un profil Vélo"`
- Inputs (grille 2×2):
  - `FTP (W)` | `Poids (kg)` | `FC LT1 (bpm)` | `FC LT2 (bpm)`
  - + `CP Montée (W)` | `CP Home Trainer (W)` (optionnels)
- Bouton `"Créer le profil"` (primary)
- Action: INSERT dans `physio_profiles` avec `valid_from = now()`, `sport = "VELO"`
- **Important**: NE PAS supprimer l'ancien profil — mettre `valid_to = now()` sur l'actif avant d'insérer le nouveau (SCD2)

**Colonne Course** (sport = `"CAP"`):
- Identique mais métriques différentes:
  - **VMA**: `vma` km/h
  - **Allure seuil LT2**: `lt2_power_pace` (m/s → `min/km`)
  - **FC LT1**: `lt1_hr` bpm
  - **FC LT2**: `lt2_hr` bpm
- Formulaire: `VMA (km/h)` | `Allure LT2 (mm:ss/km)` | `FC LT1` | `FC LT2`

**Footer Légende Clinique:**
- Fond `bg-primary/5`
- 3 colonnes: `LT1 "Seuil Aérobie"` | `LT2 "Seuil Anaérobie"` | `FTP/CP "Puissance Seuil"`
- Chaque colonne: fond coloré + description clinique courte

---

### PAGE 6: `/health` — HealthPage

**Source de données**: `daily_readiness` + `view_health_radar`

**Header:**
- H2: icône `analytics` + `"Suivi Biométrique & Readiness"`
- Dropdown athlète (`w-64`): `"Tous les athlètes"` + liste alphabétique
- Boutons: icône `notifications` (avec dot orange si alertes) + `"Exporter PDF"` (primary, icône `download`)

**Section Import HRV4Training:**

Card avec titre `upload_file` + `"Import de données HRV4Training"` + badge `"Format CSV requis"`

Zone drag & drop:
```
[border-2 border-dashed border-slate-200 hover:border-primary rounded-xl p-8]
  [cloud_upload icône, text-accent-blue, bg-accent-blue/10 rounded-full p-4]
  "Glissez-déposez votre export HRV4Training ici"
  "Ou cliquez pour parcourir vos fichiers"
  [format hint en font-mono bg-slate-50 rounded p-2]:
  "Format: email ; date ; heure ; FC repos ; rMSSD"
```

Format CSV attendu:
```
email;date;heure;FC repos;rMSSD
lucas@example.com;2026-03-09;07:30;44;68.4
```

Logique import:
1. Parse CSV ligne par ligne
2. Match email → `athletes.email` → `athlete_id`
3. UPSERT dans `daily_readiness (athlete_id, date)` avec `rmssd`, `resting_hr`
4. Afficher résumé: `"X lignes importées, Y ignorées (doublons), Z erreurs"`

**Tableau biométrique** (source: `view_health_radar`):

Colonnes:
| Colonne | Champ | Format |
|---------|-------|--------|
| Athlète | `athlete` | Nom + avatar initiales |
| Date | `date` | `dd/MM/yyyy` |
| rMSSD (ms) | `rmssd_matinal` | Valeur numérique |
| FC repos | `fc_repos` | `XX bpm` |
| Tendance rMSSD | `tendance_rmssd_pct` | `trending_up/down XX%` coloré |
| Poids | `poids` | `XX.X kg` ou `—` si null |
| Actions | — | `more_horiz` (futur: édition) |

Tendance:
- `> 0%` → `trending_up` en `text-emerald-600` sur fond `bg-emerald-100/50`
- `< -5%` → `trending_down` en `text-rose-700` sur fond `bg-rose-100/50`
- Entre: `horizontal_rule` en `text-slate-500`

Pagination: `"Affichage de X sur Y mesures"` + boutons Précédent/Suivant

**Grille résumé médical** (3 colonnes):

1. **Alertes de Santé**
   - Icône `health_and_safety` fond `bg-emerald-100`
   - Valeur: nombre athlètes avec rMSSD < 80% de leur moyenne 30j
   - Si 0 → `text-emerald-600` + `"Aucune anomalie détectée"`

2. **Readiness Cohorte**
   - Icône `groups` fond `bg-primary/10`
   - Valeur: % athlètes avec rMSSD ≥ moyenne 30j
   - `"État de forme global [optimal/à surveiller] pour l'entraînement"`

3. **Dernière Sync**
   - Icône `history` fond `bg-amber-100`
   - Valeur: date/heure du dernier enregistrement dans `daily_readiness`
   - Nom de l'athlète concerné

---

### PAGE 7: `/athletes/:id/trends` — AthleteTrendsPage

**Ce design est en dark mode par défaut dans le mockup de référence.**

**Layout**: header sticky + sidebar gauche (profil athlète) + main content

**Source**: `daily_readiness` WHERE `athlete_id = :id` + `activities` WHERE `athlete_id = :id`

**Sidebar profil athlète:**
- Avatar circulaire (initiales, fond `bg-primary`, border `border-2 border-accent-orange`)
- Nom athlète + `"Athlète Élite • [sport principal]"`
- Nav verticale:
  - `dashboard` → `"Vue d'ensemble"`
  - `favorite` → `"Santé & Bio"` (actif)
  - `bolt` → `"Performance"`
  - `bedtime` → `"Sommeil"`
- Badge statut: point vert animé + `"Prêt pour l'entraînement"` (si rMSSD ≥ 30j avg)

**Header contenu:**
- Breadcrumb: `"Athlètes / [Nom]"`
- H2: `"Rapport de Santé Détaillé"` — `text-4xl font-bold`
- Subtitle: `"Analyse des tendances biométriques • 7 derniers jours"`
- Boutons: `"Exporter"` (icône `share`) + `"Période"` (icône `calendar_today`, accent orange)

**Summary Cards** (3 colonnes — source: `daily_readiness` 7 derniers jours):

1. **rMSSD** (variabilité cardiaque):
   - Valeur: dernière valeur `rmssd` en `ms`
   - Delta vs `rmssd_30d_avg`: `+X%` en vert si positif
   - Sparkline: 7 barres verticales (hauteur proportionnelle à `rmssd`)
   - Commentaire: `"Variabilité cardiaque stable et optimale."` (si > avg) ou alerte

2. **FC au repos**:
   - Valeur: dernière `resting_hr` en `bpm`
   - Delta vs `resting_hr_30d_avg`
   - Sparkline barres orange
   - Commentaire: `"Baisse positive de la fréquence cardiaque."` (si FC baisse = bon)

3. **Poids**:
   - Valeur: dernier `poids` (si disponible via `view_health_radar`) ou `--`
   - Delta semaine
   - Sparkline barres slate
   - Commentaire: `"Variation stable sur la semaine."`

**Graphique tendances** (Recharts `LineChart`):
- Axe X: 7 jours (Lundi → Dimanche, labels en français)
- Axe Y: valeurs rMSSD ou FC (toggleable)
- Zone normale (bande): `rmssd_30d_avg ± 0.5 × SD` en `#slate-200/20`
- Courbe principale: orange avec aire shaded en dégradé `from-accent-orange/30 to-transparent`
- Points de données: cercles avec tooltip au hover

**Section Alertes & Notes** (2 colonnes):

**Gauche — Alertes:**
- Chaque alerte: `border-l-4` colorée + icône + titre + description + timestamp
  - Orange: `"Récupération Incomplète"` si rMSSD < 80% avg
  - Vert: `"Statut Optimal"` si rMSSD > avg + 5%

**Droite — Notes Coach:**
- Avatar coach + nom + timestamp
- Texte libre (futur: depuis un champ `coach_comment` en DB)
- Boutons: `"Répondre"` | `"Approuver"`

---

## 6. BASE DE DONNÉES — SCHÉMA SUPABASE

### Tables principales

**`athletes`** (61 lignes):
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid | PK |
| `first_name` | text | |
| `last_name` | text | |
| `email` | text | nullable, pour match HRV import |
| `nolio_id` | text | unique, nullable |
| `is_active` | boolean | default true |
| `coach_id` | uuid | FK → user_profiles.id |
| `start_date` | date | |
| `created_at` | timestamptz | |

**`activities`** (4719 lignes):
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid | PK |
| `athlete_id` | uuid | FK → athletes.id |
| `nolio_id` | text | unique |
| `session_date` | timestamptz | |
| `sport_type` | text | CAP, VELO, NAT, SKI, etc. |
| `activity_name` | text | ex: "Fractionné 6x1000m" |
| `work_type` | text | endurance, intervals, competition |
| `duration_sec` | float | |
| `distance_m` | float | |
| `load_index` | float | MLS (0-10+) |
| `avg_hr` | float | bpm |
| `avg_power` | float | Watts |
| `interval_pace_mean` | float | min/km (decimal) |
| `interval_pace_last` | float | min/km (decimal) |
| `interval_power_mean` | float | Watts |
| `interval_power_last` | float | Watts |
| `interval_hr_mean` | float | bpm |
| `interval_hr_last` | float | bpm |
| `decoupling_index` | float | % |
| `rpe` | integer | 1-10, nullable |
| `elevation_gain` | float | mètres |
| `interval_detection_source` | text | plan, lap, algo |
| `manual_interval_*` | float | 6 colonnes manual override |
| `manual_interval_block_1_*` | float | 6 colonnes bloc 1 |
| `manual_interval_block_2_*` | float | 6 colonnes bloc 2 |

**`activity_intervals`** (5676 lignes):
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid | PK |
| `activity_id` | uuid | FK → activities.id |
| `type` | text | work, rest, warmup, cooldown |
| `start_time` | float | seconds from start |
| `end_time` | float | seconds from start |
| `duration` | float | seconds |
| `avg_speed` | float | m/s |
| `avg_power` | float | Watts |
| `avg_hr` | float | bpm |
| `avg_cadence` | float | |
| `decoupling` | float | % |
| `detection_source` | text | plan, lap, algo |
| `respect_score` | float | 0-100% |

**`physio_profiles`** (82 lignes, SCD Type 2):
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid | PK |
| `athlete_id` | uuid | FK → athletes.id |
| `sport` | text | VELO, CAP, NAT |
| `lt1_hr` | integer | bpm seuil aérobie |
| `lt2_hr` | integer | bpm seuil anaérobie |
| `lt1_power_pace` | float | W ou m/s selon sport |
| `lt2_power_pace` | float | W ou m/s selon sport |
| `cp_cs` | float | Critical Power (FTP) en Watts |
| `cp_montee` | float | CP montée en Watts |
| `cp_ht` | float | CP home trainer en Watts |
| `vma` | float | km/h |
| `weight` | float | kg |
| `valid_from` | timestamptz | début validité |
| `valid_to` | timestamptz | NULL = actif |

**`daily_readiness`** (6726 lignes):
| Colonne | Type | Notes |
|---------|------|-------|
| `athlete_id` | uuid | PK composite |
| `date` | date | PK composite |
| `rmssd` | float | ms |
| `resting_hr` | float | bpm |
| `sleep_duration` | float | heures |
| `sleep_score` | float | |
| `rmssd_30d_avg` | float | moyenne glissante 30j |
| `resting_hr_30d_avg` | float | moyenne glissante 30j |

**`user_profiles`** (1 ligne):
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid | PK, FK → auth.users.id |
| `role` | text | "coach" ou "athlete" |
| `display_name` | text | |

### Vues (READ ONLY — SELECT uniquement)

**`view_athlete_monitoring_karo`** — Source page Activities:
```
activity_id, athlete, Date, Sport, Lieu, Séance, Type, Durée, KM,
Hr Séance, Intensité Séance, PmoyW, HRmeanW, Allure Moy,
Puissance (Last), HRmean (Last), Allure (Last), Découplage,
Q1, Q2, Q3, Q4, MLS, Source,
interval_blocks_count, interval_block_1_*, interval_block_2_*,
session_group_type, session_group_id, session_group_role, session_group_order
```

**`view_weekly_monitoring`** — Source heatmap dashboard:
```
athlete, week_start, mls_hebdo, heures_hebdo, nb_seances
```

**`view_health_radar`** — Source page Health:
```
athlete_id, athlete, date, rmssd_matinal, fc_repos, tendance_rmssd_pct, poids
```

**`view_live_flux`** — Source feed activité récente:
```
athlete, seance, type_seance, sport, mls, rpe, decouplage,
duree_min, km, bpm_moyen, temp, hum, date_heure
```

---

## 7. UTILITAIRES OBLIGATOIRES

### `src/lib/cn.ts`
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `src/services/format.service.ts`
```ts
// m/s → "X'XX /km"
export function speedToPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

// secondes → "H:mm:ss" ou "mm:ss"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// mètres → "XX.X km"
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// min/km decimal → "X'XX /km"
export function formatPaceDecimal(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}
```

### `src/lib/constants.ts`
```ts
export const SPORT_ICONS: Record<string, string> = {
  CAP: "directions_run",
  VELO: "directions_bike",
  NAT: "pool",
  SKI: "downhill_skiing",
  TRI: "directions_run",
  MUSC: "fitness_center",
};

export const SPORT_COLORS: Record<string, string> = {
  CAP: "text-accent-orange",
  VELO: "text-accent-blue",
  NAT: "text-teal-500",
  SKI: "text-violet-500",
};

export const MLS_LEVEL = (mls: number) => {
  if (mls < 2) return { bg: "#f1f5f9", label: "Repos" };
  if (mls < 4) return { bg: "#bfdbfe", label: "Faible" };
  if (mls < 6) return { bg: "#60a5fa", label: "Modéré" };
  if (mls < 8) return { bg: "#f97316", label: "Élevé" };
  return { bg: "#ea580c", label: "Critique" };
};
```

---

## 8. THÈME DARK/LIGHT

- Toggle persisté en `localStorage` sous la clé `"theme"`
- Appliqué via `class="dark"` sur `<html>` (PAS `@media prefers-color-scheme`)
- `useTheme.ts`: retourne `theme`, `toggleTheme`, applique la classe `dark` sur `document.documentElement`
- Bouton toggle dans la sidebar: icône `light_mode` (si dark) ou `dark_mode` (si light)
- TOUTES les pages supportent les deux modes

---

## 9. DEPLOY (Railway)

### `Dockerfile`
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### `nginx.conf`
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
}
```

### `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE" },
  "deploy": { "healthcheckPath": "/" }
}
```

### Variables d'environnement Railway:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 10. CI/CD (`.github/workflows/ci_web.yml`)

```yaml
name: CI Web
on:
  push:
    paths: ["web/**"]
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "npm", cache-dependency-path: web/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

---

## 11. CONTRAINTES QUALITÉ

1. **`tsc --noEmit` = 0 erreurs** (strict mode)
2. **Aucun import Supabase dans `components/`** — uniquement dans `repositories/`
3. **Responsive**: fonctionne sur 375px mobile et desktop 1440px
4. **Pagination server-side** avec `.range(from, to)` Supabase (pas de `SELECT *` sans limit)
5. **Toutes les pages** supportent dark/light mode
6. **Lexend** partout, **Material Symbols Outlined** pour toutes les icônes
7. **Couleurs exactes**: primary `#240066`, accent `#f97316`, vert `#0bda6f`, BG `#f6f5f8`

---

## 12. ORDRE D'IMPLÉMENTATION RECOMMANDÉ

1. Setup (package.json, vite.config, tsconfig, index.html, index.css, lib/)
2. Types (database.ts, domain types)
3. Auth (useAuth, LoginPage, ProtectedRoute)
4. Layout (Sidebar, Header, CoachLayout)
5. UI primitives (Button, Badge, Card, Icon, MetricCard)
6. ActivitiesPage (repository + service + hook + table + filters)
7. DashboardPage (heatmap + alertes + feed)
8. ActivityDetailPage (graphique + intervals + sidebar actions)
9. ProfilesPage (SCD2 physio)
10. HealthPage (HRV import + table)
11. AthleteTrendsPage (sparklines + chart)
12. Deploy (Dockerfile + nginx + CI)
