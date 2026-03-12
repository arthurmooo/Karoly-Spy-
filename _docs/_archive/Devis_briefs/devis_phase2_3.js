const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

const BLUE   = "1A56A0";
const GREY   = "F5F5F5";
const LGREY  = "F0F0F0";
const MGREY  = "CCCCCC";
const WHITE  = "FFFFFF";
const BLACK  = "222222";
const GREEN  = "1A7A4A";

const border  = (color = MGREY) => ({ style: BorderStyle.SINGLE, size: 1, color });
const borders = (color = MGREY) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: BLACK, ...opts })]
  });
}

function paraRuns(runs, paraOpts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    ...paraOpts,
    children: runs.map(r => new TextRun({ font: "Arial", size: 22, color: BLACK, ...r }))
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: " ", size: 20 })] });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: "Arial", size: 22, color: BLUE })]
  });
}

// ── Tableau de prestation ───────────────────────────────────────────────────
function prestationTable() {
  const colWidths = [4400, 800, 1400, 2426]; // désignation, qté, PU, total

  const headerRow = new TableRow({
    children: ["Désignation", "Qté (h)", "Prix unitaire", "Total"].map((t, i) => new TableCell({
      borders: borders(BLUE),
      shading: { fill: BLUE, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      width: { size: colWidths[i], type: WidthType.DXA },
      children: [new Paragraph({ alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })] })]
    }))
  });

  const lots = [
    {
      label: "LOT 1 - MVP Plateforme (Modules 1, 2 & 3)",
      items: [
        ["Dashboard coach : migration Retool → web app, heatmap de charge, détection manuelle d'intervalles (fallback Nolio), gestion des utilisateurs (invitations, groupes, suppressions), bouton Reprocess", "20", "40 €/h", "800 €"],
        ["Espace athlète : authentification multi-rôles, vue calendrier semaine/mois/année, filtres de séances, visualisations (découplage, intervalles), feedback coach ↔ athlète", "28", "40 €/h", "1 120 €"],
        ["Fiches semaine & mois : KPIs automatiques, analyses textuelles par règles, export PDF à la marque Karoly Spy", "15", "40 €/h", "600 €"],
        ["Setup technique : Next.js, Supabase Auth, Railway, domaine, CI/CD", "7", "40 €/h", "280 €"],
      ],
      subtotal: "2 800 €",
    },
    {
      label: "LOT 2 - Features Avancées (Modules 4, 5 & 6)",
      items: [
        ["Espace compétition & Race Analysis : détection automatique, découplage par discipline (nat/vélo/run), analyse des transitions T1/T2, fiche de course exportable", "35", "40 €/h", "1 400 €"],
        ["Comparaison de courses : mode toggle, comparaison métriques entre éditions (ex : Embrunman 2025 vs 2024)", "17", "40 €/h", "680 €"],
        ["Cartographie : Mapbox (compétitions) + Leaflet/OpenFreeMap (séances), tracé coloré par intensité", "10", "40 €/h", "400 €"],
      ],
      subtotal: "2 480 €",
    },
  ];

  const rows = [headerRow];

  for (const lot of lots) {
    // Ligne lot header
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 5,
        borders: borders(BLUE),
        shading: { fill: "D6E4F5", type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: lot.label, bold: true, font: "Arial", size: 20, color: BLUE })] })]
      })]
    }));

    // Lignes items
    lot.items.forEach(([desc, qty, pu, total], idx) => {
      rows.push(new TableRow({
        children: [
          new TableCell({
            borders: borders(),
            shading: { fill: idx % 2 === 0 ? WHITE : LGREY, type: ShadingType.CLEAR },
            margins: { top: 70, bottom: 70, left: 140, right: 140 },
            width: { size: colWidths[0], type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: desc, font: "Arial", size: 19, color: BLACK })] })]
          }),
          ...[qty, pu, total].map((val, ci) => new TableCell({
            borders: borders(),
            shading: { fill: idx % 2 === 0 ? WHITE : LGREY, type: ShadingType.CLEAR },
            margins: { top: 70, bottom: 70, left: 140, right: 140 },
            width: { size: colWidths[ci + 1], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: val, font: "Arial", size: 19, color: BLACK })] })]
          }))
        ]
      }));
    });

    // Sous-total lot
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          borders: borders(MGREY),
          shading: { fill: LGREY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Sous-total ${lot.label.split('-')[0].trim()}`, bold: true, font: "Arial", size: 20, color: BLACK })] })]
        }),
        new TableCell({
          borders: borders(MGREY),
          shading: { fill: LGREY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          width: { size: colWidths[3], type: WidthType.DXA },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: lot.subtotal, bold: true, font: "Arial", size: 20, color: BLUE })] })]
        }),
      ]
    }));
  }

  // Total général
  rows.push(new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        borders: borders(BLUE),
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TOTAL", bold: true, font: "Arial", size: 22, color: WHITE })] })]
      }),
      new TableCell({
        borders: borders(BLUE),
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        width: { size: colWidths[3], type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "5 280 €", bold: true, font: "Arial", size: 22, color: WHITE })] })]
      }),
    ]
  }));

  rows.push(new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        borders: borders(MGREY),
        shading: { fill: LGREY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TVA non applicable - art. 293 B du CGI", font: "Arial", size: 19, color: "666666", italics: true })] })]
      }),
      new TableCell({
        borders: borders(MGREY),
        shading: { fill: LGREY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        width: { size: colWidths[3], type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "0 €", font: "Arial", size: 19, color: "666666", italics: true })] })]
      }),
    ]
  }));

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: colWidths,
    margins: { top: 200, bottom: 200 },
    rows
  });
}

// ── DOCUMENT ──────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1200, right: 1200, bottom: 1400, left: 1200 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 8 } },
          children: [
            new TextRun({ text: "DEVIS N° 2026-002", bold: true, font: "Arial", size: 18, color: BLUE }),
            new TextRun({ text: "\t", font: "Arial", size: 18 }),
            new TextRun({ text: "Projet KS Endurance Training - Phases 2 & 3", font: "Arial", size: 18, color: "888888" }),
          ],
          tabStops: [{ type: "right", position: 9026 }]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: MGREY, space: 6 } },
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

      // ── EN-TÊTE DEVIS ───────────────────────────────────────────────────
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [4500, 4526],
        margins: { top: 0, bottom: 200 },
        rows: [new TableRow({
          children: [
            // Prestataire
            new TableCell({
              borders: noBorders,
              margins: { top: 0, bottom: 0, left: 0, right: 200 },
              children: [
                para("Arthur MÔ", { bold: true, size: 26, color: BLUE }),
                para("Ingénieur Data & IA - Freelance", { size: 20, color: "555555" }),
                spacer(),
                para("arthur.mo.perso@gmail.com", { size: 20 }),
              ]
            }),
            // Infos devis
            new TableCell({
              borders: noBorders,
              margins: { top: 0, bottom: 0, left: 200, right: 0 },
              children: [
                new Table({
                  width: { size: 4326, type: WidthType.DXA },
                  columnWidths: [2000, 2326],
                  rows: [
                    ...[
                      ["Devis N°", "2026-002"],
                      ["Date", "20 février 2026"],
                      ["Validité", "30 jours"],
                      ["Client", "Karoly Spy"],
                    ].map(([label, value], idx) => new TableRow({
                      children: [
                        new TableCell({
                          borders: borders(),
                          shading: { fill: idx % 2 === 0 ? LGREY : WHITE, type: ShadingType.CLEAR },
                          margins: { top: 60, bottom: 60, left: 120, right: 120 },
                          width: { size: 2000, type: WidthType.DXA },
                          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: "Arial", size: 19, color: "555555" })] })]
                        }),
                        new TableCell({
                          borders: borders(),
                          shading: { fill: idx % 2 === 0 ? LGREY : WHITE, type: ShadingType.CLEAR },
                          margins: { top: 60, bottom: 60, left: 120, right: 120 },
                          width: { size: 2326, type: WidthType.DXA },
                          children: [new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 19, color: BLACK })] })]
                        }),
                      ]
                    }))
                  ]
                })
              ]
            }),
          ]
        })]
      }),

      spacer(),

      // ── OBJET ──────────────────────────────────────────────────────────
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        margins: { top: 100, bottom: 200 },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: border(BLUE), bottom: border(BLUE), left: { style: BorderStyle.SINGLE, size: 8, color: BLUE }, right: border(BLUE) },
            shading: { fill: "EEF4FB", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 200, right: 200 },
            children: [
              paraRuns([
                { text: "Objet : ", bold: true, color: BLUE },
                { text: "Développement de la plateforme web Projet KS Endurance Training - Espace coach & athlètes, Race Analysis, Comparaison de courses, Cartographie" }
              ])
            ]
          })]
        })]
      }),

      spacer(),

      // ── CONTEXTE ───────────────────────────────────────────────────────
      sectionTitle("Contexte"),
      para("Ce devis fait suite à la livraison de la Phase 1 de Projet KS Endurance Training (ingestion automatique Nolio, calcul des métriques physiologiques, tableau de bord Retool) et à la validation de la feuille de route des Phases 2 & 3 présentée dans le brief du 20 février 2026."),
      spacer(),
      para("Le périmètre a évolué par rapport à l'estimation initiale : la vision arrêtée ensemble porte désormais sur une plateforme web complète avec espace coach, espace athlète, et des modules d'analyse avancée des compétitions. Le devis est structuré en deux lots livrables indépendamment."),
      spacer(),

      // ── PRESTATIONS ────────────────────────────────────────────────────
      sectionTitle("Détail des prestations"),
      spacer(),
      prestationTable(),
      spacer(),

      // ── NOTE SCOPE ─────────────────────────────────────────────────────
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        margins: { top: 80, bottom: 160 },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 8, color: "CCCCCC" }, right: noBorder },
            shading: { fill: WHITE, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 200, right: 200 },
            children: [
              para("Note sur le périmètre : le Lot 1 peut être livré et mis en production indépendamment du Lot 2. Le Lot 2 sera commandé séparément sur validation du Lot 1.", { size: 19, color: "666666", italics: true })
            ]
          })]
        })]
      }),

      spacer(),

      // ── CONDITIONS ─────────────────────────────────────────────────────
      sectionTitle("Conditions"),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [2400, 6626],
        margins: { top: 100, bottom: 200 },
        rows: [
          ...[
            ["Modalités de paiement", "Lot 1 (2 800 €) : 3 mensualités de 934 € - 1re à la commande, 2e à mi-livraison, 3e à la livraison finale.\nLot 2 (2 480 €) : 3 mensualités de 827 € - même principe, démarrage après validation du Lot 1."],
            ["Délai de livraison", "Lot 1 : environ 6 semaines après commande.\nLot 2 : environ 5 semaines après commande du Lot 2."],
            ["Retours & révisions", "3 cycles de retours inclus par lot.\nCorrections de bugs gratuites pendant 60 jours après livraison (bug = fonctionnalité ne respectant pas le devis).\nÉvolutions et nouvelles fonctionnalités hors scope facturées à 40 € HT/h."],
            ["Propriété intellectuelle", "Le code livré est la propriété exclusive de Karoly Spy à réception de la dernière mensualité de chaque lot."],
            ["Validité du devis", "30 jours à compter de la date d'émission."],
          ].map(([label, value], idx) => new TableRow({
            children: [
              new TableCell({
                borders: borders(),
                shading: { fill: idx % 2 === 0 ? LGREY : WHITE, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                width: { size: 2400, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: "Arial", size: 20, color: BLACK })] })]
              }),
              new TableCell({
                borders: borders(),
                shading: { fill: idx % 2 === 0 ? LGREY : WHITE, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                width: { size: 6626, type: WidthType.DXA },
                children: value.split('\n').map(line => new Paragraph({ spacing: { before: 20, after: 20 }, children: [new TextRun({ text: line, font: "Arial", size: 20, color: BLACK })] }))
              }),
            ]
          }))
        ]
      }),

      spacer(),

      // ── SIGNATURE ──────────────────────────────────────────────────────
      sectionTitle("Bon pour accord"),
      spacer(),
      para("En signant ce document, le client accepte les conditions ci-dessus et autorise le démarrage des travaux du lot concerné."),
      spacer(),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [4400, 4626],
        margins: { top: 100, bottom: 0 },
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: borders(),
              shading: { fill: LGREY, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 200, left: 200, right: 200 },
              children: [
                para("Le prestataire", { bold: true, color: BLUE }),
                para("Arthur MÔ", { size: 20 }),
                spacer(),
                spacer(),
                para("Signature :", { size: 19, color: "888888" }),
                spacer(),
              ]
            }),
            new TableCell({
              borders: borders(),
              shading: { fill: LGREY, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 200, left: 200, right: 200 },
              children: [
                para("Le client", { bold: true, color: BLUE }),
                para("Karoly Spy", { size: 20 }),
                spacer(),
                spacer(),
                para("Signature + mention « Bon pour accord » :", { size: 19, color: "888888" }),
                spacer(),
              ]
            }),
          ]
        })]
      }),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/laughing-optimistic-galileo/mnt/Dossier de travail /Devis_ProjectK_Phases2_3.docx', buffer);
  console.log('Done.');
});
