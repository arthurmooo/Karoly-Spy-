# Rapport Karoly - Etat Actuel vs Etat Final (Simulation)

Date: 2026-02-11  
Projet: `Project K` (`ayczcnoxgaljkyiljill`)  
Pipeline audité: **exactement celui du robot d'ingestion**  
`/.github/workflows/robot_v8.yml` -> `python run_k.py ingest --days 3`

## 1) Périmètre et méthode

- Source de vérité auditée: `.github/workflows/robot_v8.yml` + `run_k.py` + `scripts/run_ingest.py` + `projectk_core/processing/*`.
- Replays effectués en **dry-run** (pas d'écriture DB), en priorisant les `.fit` déjà présents en base (fallback API Nolio seulement si nécessaire).
- Exclusion demandée: **cas multi-bloc `5x1000 + 9km`** (non traité comme critère d'acceptation final).
- Aucun push effectué.

## 2) Changements appliqués dans le code (non push)

- `/Users/arthurmo/Documents/Pro/Freelance/Jobs/Karo Spy/Dossier de travail /projectk_core/processing/interval_matcher.py`
  - Sur les fractions courtes, utilisation de l'allure **LAP native** (alignée Nolio) au lieu de la moyenne stream.
  - Garde la moyenne stream sur les blocs longs (pour éviter les régressions tempo).
- `/Users/arthurmo/Documents/Pro/Freelance/Jobs/Karo Spy/Dossier de travail /projectk_core/processing/calculator.py`
  - Filtre robuste sur les outliers run (vitesses anormales / bloc trop long dans une séance de répétitions).
  - Validation d'une séance intervalle **LAP-dominante** même si un intervalle passe en `signal`.
  - Validation des séances **mono-bloc signal** avec confiance suffisante (évite des `NULL` injustifiés).

## 3) SOT vs Algo (avant/après simulation)

### Cas "moyenne intervalle / dernier intervalle" avec SOT explicite

| Cas | SOT (Nolio) | Algo actuel (avant) | Algo final simulé (après) | Statut |
|---|---|---:|---:|---|
| Laurent 20x1'30 r45 | 3:36 / 3:33 | `NULL / NULL` | **3:35 / 3:32** | Résolu |
| Tanguy 14x1km r250m | 3:28 / 3:26 | `NULL / NULL` | **3:28 / 3:25** | Résolu |
| Gilles 15x2 r1 | 4:00 / 3:58 | `NULL / NULL` | **3:58 / 3:56** | Résolu (écart résiduel ~2s) |
| Robin 15x1 r1 | 3:22 / 3:15 | 3:34 / 3:28 (retour Karoly) | **3:21 / 3:14** | Résolu |

### Cas "moyenne / dernier" sans SOT chiffré exploitable dans le feedback

| Cas | Algo actuel (avant) | Algo final simulé (après) | Statut |
|---|---:|---:|---|
| Sylvain 20x500 r150m | `NULL / NULL` | **4:03 / 4:14** | Résolu (détection revenue) |
| Louis vélo tempo (`91274480`) | `NULL / NULL` | **251.5W / 251.5W** | Résolu techniquement, validation métier Karoly à faire |
| Thierry HT (`90936823`) | 314.8W / 305.8W | 314.8W / 305.8W | Stable (calcul cohérent FIT/LAP), validation métier Karoly à faire |

## 4) Non-régression (échantillon hors feedback)

Replays dry-run effectués sur 6 séances run/bike déjà "bonnes".  
Constat: pas de régression bloquante observée.

- `90753573` (Baptiste 12x1k): delta moyen `-0.6s`, dernier `0.0s`
- `90793644` (Lucas 10x1k): delta moyen `0.0s`, dernier `+1.8s`
- `90739134` (Louis 2x11k): delta moyen `-0.6s`, dernier `-0.6s`
- `91026637` (Tanguy 20x500): delta moyen `+2.4s`, dernier `+1.8s`
- `91291674` (Louis tempo run): delta moyen `0.0s`, dernier `0.0s`
- `90936823` / `90793394` (bike HT): stables

## 5) Point par point sur tout le feedback Karoly

### A. Missing Intervals / Structure

1. Baptiste 21km `5x1km + 9km tempo`  
Statut: **Hors scope demandé** (multi-bloc exclu).

2. Laurent `20x1'30 r45`  
Statut: **Résolu** (plus de `NULL`, valeurs alignées SOT).

3. Sylvain `20x500 r150`  
Statut: **Résolu** (plus de `NULL`, séance validée).

4. Lucas Brick (Bike + Run)  
Statut: **Partiel**. Backend ingestion contient bien les 2 activités (bike + run), mais la vue côté app peut encore n'en afficher qu'une selon filtres/liaison.

### B. Data Accuracy / Calcul

5. Lucas HT `15x2 r1` (Q4/durability)  
Statut: **A vérifier métier**. Dans les données auditées, `durability_index=1.311` (pas 1.89), mais le sujet Q4 home-trainer reste à valider selon la formule attendue.

6. Louis vélo tempo (avg power / last power)  
Statut: **Résolu techniquement**, comparaison métier finale Karoly requise (feedback initial sans valeurs SOT numériques exploitables dans le texte).

7. Thierry home trainer (avg power / last power)  
Statut: **Stable techniquement** (cohérent FIT/LAP), validation Karoly requise.

8. Tanguy `14x1km r250m`  
Statut: **Résolu** (écart réduit à ~1s).

9. Gilles `15x2 r1`  
Statut: **Résolu** (écart résiduel ~2s).

10. Robin `15x1 r1`  
Statut: **Résolu**.

11. Steven `5x1km + 9km` (last pace)  
Statut: **Hors scope demandé** (multi-bloc exclu).

### C. Workflow / UX

12. Re-analyse forcée d'une séance déplacée  
Statut: **Backlog produit** (non implémenté dans ce lot).

13. Outil de comparaison de séances proches (±1 min)  
Statut: **Backlog produit** (non implémenté dans ce lot).

## 6) Conclusion opérationnelle

- Objectif demandé (hors cas multi-bloc): atteint en simulation dry-run sur les points moyenne/dernier intervalle.
- Rien n'a été push.
- Prochaine étape après validation de ce rapport: appliquer le recalcul ciblé en écriture DB sur les séances concernées, puis fournir un rapport "post-write" final.
