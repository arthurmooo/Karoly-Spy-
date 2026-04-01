# Environnements et Releases

## Architecture cible
- `main` = production MVP utilisée par Karo
- `phase-2` = branche longue durée de développement
- `feature/*` = branches de travail ponctuelles dérivées de `phase-2`

## Mapping des environnements
### Production
- Git branch: `main`
- Cloudflare Pages: `Production`
- Supabase: projet `Project K` (`ayczcnoxgaljkyiljill`)
- Variables frontend:
  - `VITE_SUPABASE_URL` = URL Supabase prod
  - `VITE_SUPABASE_ANON_KEY` = anon key prod

### Preview / développement
- Git branch principale: `phase-2`
- Cloudflare Pages: `Preview`
- Supabase: projet `Project K Dev`
- Variables frontend:
  - `VITE_SUPABASE_URL` = URL Supabase dev
  - `VITE_SUPABASE_ANON_KEY` = anon key dev

## Règles de travail
- Ne plus committer directement sur `main`
- Utiliser `phase-2` pour le développement continu
- Utiliser `feature/*` pour les sujets risqués ou isolés
- Ne merger vers `main` que pour un release volontaire ou un hotfix MVP

## Checklist de setup
### GitHub
- Protéger `main`
- Exiger une Pull Request avant merge
- Interdire le push direct sur `main`
- Garder le build web requis avant merge

### Cloudflare Pages
- `Production` branchée sur `main`
- `Preview` branchée sur `phase-2` et les autres branches de preview
- Variables `Production` = Supabase prod
- Variables `Preview` = Supabase dev

### Supabase prod
- Auth `Site URL` = domaine public prod
- `Redirect URLs` = URLs prod autorisées
- Les workflows batch GitHub restent reliés à la prod

### Supabase dev
- Projet séparé du projet prod
- Appliquer toutes les migrations du repo
- Déployer les Edge Functions du repo
- Configurer Auth avec les URLs preview Cloudflare
- Recréer les secrets nécessaires côté projet dev

## Secrets à séparer
### Frontend
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Edge Functions / backend admin
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_PAT`
- `NOLIO_CLIENT_ID`
- `NOLIO_CLIENT_SECRET`
- `NOLIO_REFRESH_TOKEN`
- `NOLIO_PARTNER_ID`
- `RESEND_API_KEY`
- `STORAGE_ALERT_EMAIL`

### GitHub Actions prod
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOLIO_CLIENT_ID`
- `NOLIO_CLIENT_SECRET`
- `NOLIO_REFRESH_TOKEN`
- `OPENWEATHER_API_KEY`

## Process quotidien
### Développement phase 2
```bash
git checkout phase-2
git pull origin phase-2
```

### Nouveau sujet isolé
```bash
git checkout phase-2
git pull origin phase-2
git checkout -b feature/nom-du-sujet
```

### Release vers la prod
1. Valider le preview deploy
2. Vérifier que le preview pointe sur Supabase dev
3. Ouvrir une PR `phase-2` -> `main`
4. Merger seulement après validation
5. Faire un smoke test sur la prod

## Smoke tests obligatoires
- login / logout
- reset password
- lecture des données principales
- écriture d'une action critique
- appels Edge Functions critiques
- vérification qu'aucune donnée preview n'arrive dans la base prod
