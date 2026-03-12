const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, PageBreak,
  TableOfContents
} = require('docx');
const fs = require('fs');

// ── Couleurs & helpers ──────────────────────────────────────────────────────
const BLUE    = "1A56A0";
const LBLUE   = "D6E4F5";
const GREY    = "F5F5F5";
const MGREY   = "CCCCCC";
const WHITE   = "FFFFFF";
const BLACK   = "000000";
const ORANGE  = "E07B2A";

const border  = (color = MGREY) => ({ style: BorderStyle.SINGLE, size: 1, color });
const borders = (color = MGREY) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 30, color: BLUE })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 80 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24, color: "2C2C2C" })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: BLACK, ...opts })]
  });
}

function bodyRuns(runs) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: runs.map(r => new TextRun({ font: "Arial", size: 22, color: BLACK, ...r }))
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: BLACK })]
  });
}

function spacer(lines = 1) {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: " ".repeat(lines), size: 22 })] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Boîte colorée (titre + contenu) ────────────────────────────────────────
function colorBox(titleText, contentParagraphs, bg = LBLUE, titleBg = BLUE) {
  const titleCell = new TableCell({
    borders: noBorders,
    shading: { fill: titleBg, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 200, right: 200 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text: titleText, bold: true, font: "Arial", size: 24, color: WHITE })]
    })]
  });
  const contentCell = new TableCell({
    borders: noBorders,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 200, right: 200 },
    children: contentParagraphs
  });
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    margins: { top: 160, bottom: 160 },
    rows: [
      new TableRow({ children: [titleCell] }),
      new TableRow({ children: [contentCell] })
    ]
  });
}

// ── Module card ─────────────────────────────────────────────────────────────
function moduleCard(num, emoji, titre, quoi, pourquoi, fonctionnalites, question = null) {
  const headerCell = new TableCell({
    borders: noBorders,
    shading: { fill: BLUE, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 220, right: 220 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: `Module ${num}  ${emoji}  ${titre}`, bold: true, font: "Arial", size: 26, color: WHITE })]
      })
    ]
  });

  const rows = [new TableRow({ children: [headerCell] })];

  const contentLines = [];

  contentLines.push(new Paragraph({
    spacing: { before: 80, after: 40 },
    children: [new TextRun({ text: "Ce que c'est", bold: true, font: "Arial", size: 21, color: BLUE })]
  }));
  contentLines.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: quoi, font: "Arial", size: 21, color: BLACK })]
  }));

  contentLines.push(new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "Pourquoi maintenant", bold: true, font: "Arial", size: 21, color: BLUE })]
  }));
  contentLines.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: pourquoi, font: "Arial", size: 21, color: BLACK })]
  }));

  contentLines.push(new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "Fonctionnalités clés", bold: true, font: "Arial", size: 21, color: BLUE })]
  }));
  for (const f of fonctionnalites) {
    contentLines.push(new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: f, font: "Arial", size: 21, color: BLACK })]
    }));
  }

  if (question) {
    contentLines.push(spacer());
    contentLines.push(new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [
        new TextRun({ text: "❓ Point à valider avec toi : ", bold: true, font: "Arial", size: 21, color: ORANGE }),
        new TextRun({ text: question, font: "Arial", size: 21, color: BLACK, italics: true })
      ]
    }));
  }

  const contentCell = new TableCell({
    borders: noBorders,
    shading: { fill: GREY, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 220, right: 220 },
    children: contentLines
  });

  rows.push(new TableRow({ children: [contentCell] }));

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    margins: { top: 240, bottom: 240 },
    rows
  });
}

// ── Tableau de priorité ─────────────────────────────────────────────────────
function priorityTable() {
  const headerRow = new TableRow({
    children: ["Priorité", "Module", "Valeur pour Karoly", "Complexité"].map((t, i) => new TableCell({
      borders: borders(BLUE),
      shading: { fill: BLUE, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      width: { size: [1000, 2600, 3500, 1926][i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })]
      })]
    }))
  });

  const rows_data = [
    ["1", "Dashboard coach (migration Retool++)", "Indispensable - c'est la base de travail quotidien", "Faible"],
    ["2", "Espace athlète", "Élimine les screenshots Nolio - gain de temps immédiat", "Moyenne"],
    ["3", "Fiches semaine / mois", "Rapport automatique, export PDF partageable", "Moyenne"],
    ["4", "Espace compétition & Race Analysis", "Feature différenciante - analyse post-course en 1 clic", "Haute"],
    ["5", "Comparaison de courses", "Vision progression pluriannuelle de chaque athlète", "Moyenne"],
    ["6", "Cartographie des séances", "Visualisation GPS de chaque séance pour l'athlète", "Moyenne"],
  ];

  const dataRows = rows_data.map((r, idx) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      borders: borders(),
      shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: [1000, 2600, 3500, 1926][i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: cell, font: "Arial", size: 20, color: BLACK })]
      })]
    }))
  }));

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1000, 2600, 3500, 1926],
    margins: { top: 200, bottom: 200 },
    rows: [headerRow, ...dataRows]
  });
}

// ── Tableau stack technique ──────────────────────────────────────────────────
function stackTable() {
  const headerRow = new TableRow({
    children: ["Couche", "Technologie", "Rôle"].map((t, i) => new TableCell({
      borders: borders(BLUE),
      shading: { fill: BLUE, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      width: { size: [2000, 2500, 4526][i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })]
      })]
    }))
  });

  const stack_data = [
    ["Frontend", "Next.js 14 (App Router)", "Application web - interfaces coach & athlète"],
    ["Auth", "Supabase Auth", "Gestion des comptes, rôles coach/athlète, invitations"],
    ["Base de données", "Supabase (existant)", "Aucune migration - continuité totale avec Phase 1"],
    ["Hébergement", "Railway", "Déploiement automatique, domaine personnalisé, ~5 €/mois"],
    ["Cartographie (compét)", "Mapbox", "Maps détaillées pour les compétitions"],
    ["Cartographie (séances)", "Leaflet + OpenFreeMap", "API gratuite et sans limite pour les entraînements"],
    ["Backend ingestion", "Pipeline Python existant", "Inchangé - robot GitHub Actions toutes les 2h"],
  ];

  const dataRows = stack_data.map((r, idx) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      borders: borders(),
      shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: [2000, 2500, 4526][i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: cell, font: "Arial", size: 20, color: BLACK })]
      })]
    }))
  }));

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2000, 2500, 4526],
    margins: { top: 200, bottom: 200 },
    rows: [headerRow, ...dataRows]
  });
}

// ── DOCUMENT ─────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "–",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 300 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2C2C2C" },
        paragraph: { spacing: { before: 260, after: 80 }, outlineLevel: 1 }
      }
    ]
  },
  sections: [
    // ── PAGE DE GARDE ────────────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        spacer(2),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200, after: 120 },
          children: [new TextRun({ text: "PROJET KS ENDURANCE TRAINING", bold: true, font: "Arial", size: 60, color: BLUE })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Phases 2 & 3 - Proposition de développement", font: "Arial", size: 30, color: "555555" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 800 },
          children: [new TextRun({ text: "Plateforme web coach & athlètes", font: "Arial", size: 26, color: "888888", italics: true })]
        }),
        new Table({
          width: { size: 5000, type: WidthType.DXA },
          columnWidths: [5000],
          margins: { top: 0, bottom: 0 },
          rows: [new TableRow({
            children: [new TableCell({
              borders: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE }, bottom: noBorder, left: noBorder, right: noBorder },
              shading: { fill: WHITE, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 400, right: 400 },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Préparé par Arthur MÔ", font: "Arial", size: 22, color: "333333" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Ingénieur Data & IA", font: "Arial", size: 20, color: "888888", italics: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Février 2026", font: "Arial", size: 20, color: "888888" })] }),
              ]
            })]
          })]
        }),
        pageBreak()
      ]
    },

    // ── CONTENU ───────────────────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 8 } },
            children: [
              new TextRun({ text: "PROJET KS ENDURANCE TRAINING - Phases 2 & 3", bold: true, font: "Arial", size: 18, color: BLUE }),
              new TextRun({ text: "\t", font: "Arial", size: 18 }),
              new TextRun({ text: "Arthur MÔ · Ingénieur Data & IA", font: "Arial", size: 18, color: "888888" }),
            ],
            tabStops: [{ type: "right", position: 9026 }]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: MGREY, space: 6 } },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 18, color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888888" }),
              new TextRun({ text: " / ", font: "Arial", size: 18, color: "888888" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: "888888" }),
            ]
          })]
        })
      },
      children: [

        // ── 1. CONTEXTE ────────────────────────────────────────────────────
        h1("1. Contexte & point de départ"),
        body("La Phase 1 de Projet KS Endurance Training est livrée et opérationnelle : ingestion automatique depuis Nolio toutes les 2 heures, calcul des métriques physiologiques (charge MLS, durabilité, découplage), tableau de bord Retool fonctionnel."),
        spacer(),
        body("La limite actuelle est claire : Retool est un outil interne de développeur, pas une plateforme produit. Aujourd'hui, pour partager une analyse avec un athlète, tu fais des screenshots du tableau de bord et tu les colles dans des commentaires Nolio. C'est chronophage, peu valorisant et difficile à lire pour l'athlète."),
        spacer(),
        colorBox(
          "Le déclencheur des Phases 2 & 3",
          [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: "Construire une vraie plateforme web propriétaire - avec un espace coach complet et un espace athlète - qui automatise la communication des analyses et positionne la méthode Karoly Spy dans un outil à ton image.", font: "Arial", size: 22, color: BLACK })]
            })
          ]
        ),
        spacer(),

        // ── 2. VISION PRODUIT ──────────────────────────────────────────────
        pageBreak(),
        h1("2. Vision produit"),
        body("La plateforme se structure autour de deux espaces distincts, chacun avec sa logique propre :"),
        spacer(),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [4400, 4626],
          margins: { top: 160, bottom: 160 },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: borders(BLUE),
                  shading: { fill: BLUE, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Espace Coach", bold: true, font: "Arial", size: 24, color: WHITE })] })]
                }),
                new TableCell({
                  borders: borders(BLUE),
                  shading: { fill: BLUE, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Espace Athlète", bold: true, font: "Arial", size: 24, color: WHITE })] })]
                }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  borders: borders(),
                  shading: { fill: GREY, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  children: [
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Vue complète de tous les athlètes", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Pilotage global (heatmap de charge)", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Analyses détaillées & édition manuelle", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Accès aux fiches de course & compétitions", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Saisie de commentaires sur chaque séance", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "Gestion des utilisateurs : invitations, groupes, suppressions", font: "Arial", size: 20, color: BLACK })] }),
                  ]
                }),
                new TableCell({
                  borders: borders(),
                  shading: { fill: WHITE, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  children: [
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Accès à ses propres données uniquement", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Vue calendrier : semaine / mois / année", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Filtres de séances (sport, durée, type…)", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Analyses visuelles (découplage, intervalles)", font: "Arial", size: 20, color: BLACK })] }),
                    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "Feedback écrit vers le coach", font: "Arial", size: 20, color: BLACK })] }),
                  ]
                }),
              ]
            })
          ]
        }),

        spacer(),

        // ── 3. STACK TECHNIQUE ─────────────────────────────────────────────
        pageBreak(),
        h1("3. Stack technique"),
        body("Le choix technique découle d'une contrainte simple : ne pas casser ce qui fonctionne. Le pipeline d'ingestion Python + Supabase reste intact. On construit par-dessus."),
        spacer(),
        stackTable(),
        spacer(),
        body("Ce choix permet un déploiement en quelques minutes, des mises à jour continues sans interruption de service, et un domaine personnalisé (ex : app.karolyspy.com)."),
        spacer(),

        // ── 4. MODULES ─────────────────────────────────────────────────────
        pageBreak(),
        h1("4. Les 6 modules"),
        body("Le développement est découpé en 6 modules indépendants, livrables de manière itérative."),
        spacer(),

        moduleCard(
          "1", "📊", "Dashboard coach (migration Retool++)",
          "Migration complète des 3 pages Retool existantes (Activités, Santé, Profils Physio) vers le web app, avec des améliorations visuelles et fonctionnelles. C'est la base opérationnelle.",
          "Sans ce module, tu n'as pas d'espace de travail. C'est le socle sur lequel tout le reste se greffe.",
          [
            "Table des activités : filtres par athlète, sport, date - édition manuelle des intervalles conservée",
            "Vue Santé : RMSSD, FC repos, tendances HRV avec graphiques",
            "Profils Physio : gestion des LT1/LT2/CP avec historique (SCD Type 2)",
            "Heatmap de charge flotte : tous tes athlètes en ordonnée, semaines en abscisse, coloré vert → rouge. Basée sur la puissance critique et la vitesse critique (disponibles pour tous tes athlètes, équivalents scientifiques de LT1/LT2)",
            "Bouton Reprocess : déclenche le recalcul d'une séance sans sortir de l'interface",
            "Détection manuelle d'intervalles (fallback Nolio) : pour les séances que l'algorithme ne détecte pas automatiquement, tu sélectionnes la métrique cible (allure, puissance ou FC), le nombre de segments recherchés et leur durée (en minutes ou en km). L'appli identifie les meilleurs segments sur le graphe de la séance et affiche un tableau avec les métriques de chacun. En un clic, ces valeurs sont injectées dans les colonnes de métriques d'intervalles (pace mean, pace last, HR mean, HR last...).",
            "Intégration du RPE athlète (saisi sur Nolio à l'upload de séance) dans le calcul du score de charge MLS : le score devient métabolique, mécanique ET perceptif",
            "Gestion des utilisateurs : invitation par e-mail, création de groupes d'athlètes (ex. Elite / Préparation / Loisir), tri et filtrage par groupe, désactivation ou suppression d'un compte. Architecture multi-entraîneurs préparée dès le départ (toi + collaborateurs comme Steven Galibert) : chaque entraîneur n'accède qu'à ses propres athlètes",
          ],
          null
        ),
        spacer(),

        moduleCard(
          "2", "🏃", "Espace athlète",
          "Interface dédiée accessible à chacun de tes ~50 athlètes via invitation. Chaque athlète voit uniquement ses propres données, présentées de manière visuelle et lisible - pas la table brute Retool.",
          "Aujourd'hui tu fais des screenshots pour communiquer tes analyses. Ce module élimine ce workflow entièrement.",
          [
            "Authentification sécurisée : invitation par e-mail, accès strictement limité aux données personnelles de l'athlète",
            "Groupe visible : l'athlète voit à quel groupe il appartient (Elite, Préparation...)",
            "Vue calendrier défilable : bascule entre vue Semaine, Mois, Année",
            "Filtres de séances : sport, durée minimale, type (endurance/intervalles/compétition...)",
            "Visualisations clés : graphique de découplage, analyse des intervalles (valeur moyenne & dernière)",
            "Commentaire de coach : tu peux laisser un commentaire texte libre sur chaque séance, visible par l'athlète",
            "Feedback athlète : l'athlète peut répondre / partager ses ressentis directement dans l'appli",
            "Alerte intensité sur intervalles : si des intervalles ont été réalisés significativement au-dessus du plan, un encart s'affiche dans le débrief de séance (ex. : 'Tu es allé 8% plus vite que prévu sur ces intervalles - attention au contrôle de l'intensité')",
          ]
        ),
        spacer(),

        pageBreak(),
        moduleCard(
          "3", "📅", "Fiches semaine & mois",
          "Rapports automatiques récapitulant une semaine ou un mois d'entraînement pour chaque athlète. Accessibles dans l'espace coach et dans l'espace athlète. Exportables en PDF.",
          "Remplace le rapport PDF prévu initialement en Phase 2, avec une version live dans le web et une version exportable.",
          [
            "KPIs automatiques : km parcourus, heures d'entraînement, nombre de séances, répartition par sport",
            "Analyses textuelles générées par règles : durabilité moyenne, comparaison vs période précédente, alertes si dérive > 5%",
            "Exemples : 'En vélo, ta durabilité moyenne était de X. Soit 2% mieux que le mois dernier.'",
            "Encart 'Focus Coach' : apparaît automatiquement si une dérive cardiaque anormale est détectée",
            "Export PDF : fiche propre avec logo Karoly Spy, partageable à l'athlète ou à un sponsor",
          ]
        ),
        spacer(),

        moduleCard(
          "4", "🏆", "Espace compétition & Race Analysis",
          "Dès qu'une activité est flaggée 'compétition' (par Nolio ou notre classifier), elle est automatiquement déposée dans un espace dédié et une analyse complète est déclenchée - sans action manuelle.",
          "Feature différenciante. Actuellement une compétition comme l'Embrunman rentre dans le système comme n'importe quelle séance. Elle mérite sa propre fiche.",
          [
            "Détection automatique : flag 'compétition' issu de Nolio + classifier existant",
            "Analyse par discipline : découplage séparé sur natation, vélo et course à pied",
            "Analyse des transitions : durée T1 et T2 avec comparaison aux éditions précédentes",
            "Map interactive Mapbox : tracé du parcours avec segments colorés selon l'intensité",
            "Fiche de course partageable : visible par l'athlète dans son espace, exportable en PDF",
          ]
        ),
        spacer(),

        pageBreak(),
        moduleCard(
          "5", "⚡", "Comparaison de courses",
          "Mode activable par toggle sur n'importe quelle fiche de course. Permet de comparer deux éditions d'une même compétition (ex : Embrunman 2025 vs 2024) sur la base des métriques analysées.",
          "Basé sur une feature existante déjà développée pour un contexte trail, adaptée au format triathlon.",
          [
            "Toggle 'Mode comparaison' sur la fiche de course - désactivé par défaut",
            "Sélection de la course de référence (N-1 ou autre édition disponible en base)",
            "Comparaison des métriques clés : rythme, FC, durabilité par discipline, temps aux transitions",
            "Visualisation côte à côte ou superposée selon la métrique",
            "Nécessite que les deux éditions soient dans la base de données",
          ]
        ),
        spacer(),

        moduleCard(
          "6", "🗺️", "Cartographie des séances",
          "Affichage du tracé GPS pour chaque séance d'entraînement, directement dans la fiche activité. Complémentaire à la cartographie Mapbox des compétitions.",
          "Permet à l'athlète de retrouver visuellement ses sorties. Utilise une API gratuite pour maîtriser les coûts.",
          [
            "Leaflet + OpenFreeMap : API gratuite, sans limite de requêtes, aucun coût",
            "Tracé GPS coloré selon l'intensité (FC ou allure) sur les séances qui ont des données GPS",
            "Mapbox réservé aux compétitions uniquement (meilleure qualité cartographique, crédits maîtrisés)",
            "Activable séance par séance : pas de charge excessive au chargement de la liste",
          ],
          "Jusqu'où tu veux aller sur la richesse de la visu GPS pour les séances ? (tracé simple coloré par intensité, ou détail des segments avec statistiques au survol ?)"
        ),
        spacer(),

        // ── 5. PRIORISATION ────────────────────────────────────────────────
        pageBreak(),
        h1("5. Priorisation suggérée"),
        body("Les modules sont indépendants mais liés logiquement. Je propose l'ordre suivant :"),
        spacer(),
        priorityTable(),
        spacer(),
        body("Les modules 1 à 3 constituent le MVP de la plateforme - ils peuvent être livrés et utilisés avant que les modules 4 à 6 soient développés. Les modules 4 et 6 partagent une infrastructure cartographique commune et gagnent à être développés en parallèle. La gestion des utilisateurs (invitations, groupes, suppressions) est intégrée au Module 1 et disponible dès le lancement."),
        spacer(),

        // ── 6. COÛTS DE FONCTIONNEMENT ─────────────────────────────────────
        pageBreak(),
        h1("6. Coûts de fonctionnement"),
        body("La plateforme repose sur des services tiers dont certains sont déjà en place. Voici le récapitulatif des coûts récurrents mensuels à prévoir pour faire tourner l'application en production."),
        spacer(),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3200, 1600, 4226],
          margins: { top: 160, bottom: 160 },
          rows: [
            new TableRow({
              children: ["Service", "Coût mensuel", "Notes"].map((t, i) => new TableCell({
                borders: borders(BLUE),
                shading: { fill: BLUE, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 160, right: 160 },
                width: { size: [3200, 1600, 4226][i], type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })] })]
              }))
            }),
            ...[
              ["Supabase Pro (base de données)", "~25 €", "Déjà en place depuis la Phase 1"],
              ["Railway (hébergement app web)", "~5 €", "Alternative économique à Vercel - déploiement aussi simple, 4× moins cher"],
              ["Mapbox (cartographie compétitions)", "0 €", "Tier gratuit suffisant pour 50 athlètes et leurs courses"],
              ["Leaflet + OpenFreeMap (séances)", "0 €", "100 % gratuit, sans limite"],
              ["Nom de domaine (ex: app.karolyspy.com)", "~1 €", "Facturation annuelle (~12 €/an)"],
              ["Total mensuel", "~31 €", "Dont 25 € déjà payés - surcoût réel : ~6 €/mois"],
            ].map(([service, cost, note], idx) => new TableRow({
              children: [
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 3200, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: service, font: "Arial", size: 20, color: BLACK, bold: idx === 5 })] })]
                }),
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 1600, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cost, font: "Arial", size: 20, color: idx === 5 ? BLUE : BLACK, bold: idx === 5 })] })]
                }),
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 4226, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: note, font: "Arial", size: 20, color: BLACK, italics: true })] })]
                }),
              ]
            }))
          ]
        }),

        spacer(),
        body("Ces coûts sont indépendants de la prestation de développement. Ils sont à régler directement auprès de chaque fournisseur - je peux t'aider à configurer les comptes lors du démarrage du projet."),
        spacer(),

        // ── 7. QUESTIONS OUVERTES ──────────────────────────────────────────
        pageBreak(),
        h1("7. Points à valider avec toi"),
        body("Quelques arbitrages que j'ai besoin que tu tranches avant de démarrer :"),
        spacer(),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [400, 3500, 5126],
          margins: { top: 160, bottom: 160 },
          rows: [
            new TableRow({
              children: ["#", "Question", "Contexte"].map((t, i) => new TableCell({
                borders: borders(BLUE),
                shading: { fill: BLUE, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 160, right: 160 },
                width: { size: [400, 3500, 5126][i], type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })] })]
              }))
            }),
            ...[
              ["1", "Heatmap de charge : CP et vitesse critique validés comme base de calcul", "Karoly confirme que tous les athlètes disposent d'une puissance critique et d'une vitesse critique, équivalents scientifiques de LT1/LT2. La heatmap sera complète pour tous dès le lancement. ✅ Résolu"],
              ["2", "Cartographie des séances : niveau de détail visuel ?", "Tracé GPS simple coloré par intensité, ou segments interactifs avec statistiques au survol ?"],
              ["3", "Invitation des athlètes : comment tu veux gérer l'onboarding des 50 athlètes ?", "Tu envoies les invitations toi-même depuis ton espace coach, et ils créent leur compte en suivant le lien - ça te convient ?"],
              ["4", "Fiches semaine/mois : accessible par qui ?", "Visibles par le coach ET l'athlète dès la génération, ou le coach valide avant publication à l'athlète ?"],
              ["5", "Multi-coach : architecture multi-entraîneurs confirmée", "Karoly travaille en collaboration avec Steven Galibert et envisage de créer un groupe de coachs à terme. L'architecture est donc prévue multi-entraîneurs dès le départ, sans coût supplémentaire dans ce devis. ✅ Résolu"],
            ].map(([num, question, context], idx) => new TableRow({
              children: [
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 400, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: num, bold: true, font: "Arial", size: 20, color: BLUE })] })]
                }),
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 3500, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: question, bold: true, font: "Arial", size: 20, color: BLACK })] })]
                }),
                new TableCell({
                  borders: borders(),
                  shading: { fill: idx % 2 === 0 ? WHITE : GREY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  width: { size: 5126, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: context, font: "Arial", size: 20, color: BLACK, italics: true })] })]
                }),
              ]
            }))
          ]
        }),

        spacer(),
        spacer(),

        // ── CLOSING ────────────────────────────────────────────────────────
        colorBox(
          "L'objectif final",
          [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: "Construire un outil à ton image - pas un dashboard générique, mais une plateforme qui reflète la précision et l'exigence de la méthode Karoly Spy. Quelque chose que tes athlètes ouvrent avec plaisir et qui te libère du temps administratif pour te concentrer sur ce que tu fais mieux que quiconque : la performance.", font: "Arial", size: 22, color: BLACK, italics: true })]
            })
          ]
        ),

      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/laughing-optimistic-galileo/mnt/Dossier de travail /Brief_ProjectK_Phases2_3.docx', buffer);
  console.log('Done.');
});
