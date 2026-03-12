const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

const BLUE   = "1A56A0";
const LBLUE  = "D6E4F5";
const GREY   = "F5F5F5";
const LGREY  = "F0F0F0";
const MGREY  = "CCCCCC";
const WHITE  = "FFFFFF";
const BLACK  = "222222";
const ORANGE = "E07B2A";
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

function h1(text) {
  return new Paragraph({
    spacing: { before: 360, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 6 } },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: BLUE })]
  });
}

function h2(text, color = "2C2C2C") {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 23, color })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: " ", size: 20 })] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// Tableau d'une section d'analyse (métriques + graphiques + alertes)
// rows = [ [type, label, description, feedback?] ]
function analysisTable(rows) {
  const colWidths = [1400, 2800, 3826, 1000]; // type, item, description, OK?

  const headerRow = new TableRow({
    children: ["Type", "Élément proposé", "Description", "OK ?"].map((t, i) => new TableCell({
      borders: borders(BLUE),
      shading: { fill: BLUE, type: ShadingType.CLEAR },
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      width: { size: colWidths[i], type: WidthType.DXA },
      children: [new Paragraph({
        alignment: i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: t, bold: true, font: "Arial", size: 20, color: WHITE })]
      })]
    }))
  });

  const dataRows = rows.map(([type, label, desc], idx) => {
    const typeColor = type === "Métrique" ? "1A56A0" : type === "Graphique" ? GREEN : ORANGE;
    const typeBg   = type === "Métrique" ? "EEF4FB" : type === "Graphique" ? "EBF7EF" : "FEF3E2";
    return new TableRow({
      children: [
        new TableCell({
          borders: borders(),
          shading: { fill: typeBg, type: ShadingType.CLEAR },
          margins: { top: 70, bottom: 70, left: 140, right: 140 },
          width: { size: colWidths[0], type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: type, bold: true, font: "Arial", size: 19, color: typeColor })]
          })]
        }),
        new TableCell({
          borders: borders(),
          shading: { fill: idx % 2 === 0 ? WHITE : LGREY, type: ShadingType.CLEAR },
          margins: { top: 70, bottom: 70, left: 140, right: 140 },
          width: { size: colWidths[1], type: WidthType.DXA },
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, font: "Arial", size: 20, color: BLACK })]
          })]
        }),
        new TableCell({
          borders: borders(),
          shading: { fill: idx % 2 === 0 ? WHITE : LGREY, type: ShadingType.CLEAR },
          margins: { top: 70, bottom: 70, left: 140, right: 140 },
          width: { size: colWidths[2], type: WidthType.DXA },
          children: [new Paragraph({
            children: [new TextRun({ text: desc, font: "Arial", size: 19, color: "444444", italics: true })]
          })]
        }),
        new TableCell({
          borders: borders(),
          shading: { fill: idx % 2 === 0 ? WHITE : LGREY, type: ShadingType.CLEAR },
          margins: { top: 70, bottom: 70, left: 140, right: 140 },
          width: { size: colWidths[3], type: WidthType.DXA },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "☐", font: "Arial", size: 22, color: MGREY })]
          })]
        }),
      ]
    });
  });

  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: colWidths,
    margins: { top: 160, bottom: 200 },
    rows: [headerRow, ...dataRows]
  });
}

function legendeRow() {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    margins: { top: 0, bottom: 120 },
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: MGREY }, right: noBorder },
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 200, right: 200 },
        children: [paraRuns([
          { text: "Légende : ", bold: true, size: 19, color: "555555" },
          { text: "Métrique", bold: true, size: 19, color: BLUE },
          { text: " = valeur chiffrée affichée  |  ", size: 19, color: "666666" },
          { text: "Graphique", bold: true, size: 19, color: GREEN },
          { text: " = visualisation  |  ", size: 19, color: "666666" },
          { text: "Alerte", bold: true, size: 19, color: ORANGE },
          { text: " = message conditionnel automatique", size: 19, color: "666666" },
        ])]
      })]
    })]
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
            new TextRun({ text: "PROJET KS ENDURANCE TRAINING", bold: true, font: "Arial", size: 18, color: BLUE }),
            new TextRun({ text: "\t", font: "Arial", size: 18 }),
            new TextRun({ text: "Proposition - Analyses & Graphiques", font: "Arial", size: 18, color: "888888" }),
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

      // ── EN-TETE ────────────────────────────────────────────────────────
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: "Proposition - Analyses & Graphiques par type de séance", bold: true, font: "Arial", size: 36, color: BLUE })]
      }),
      paraRuns([
        { text: "Préparé par Arthur MÔ  |  ", size: 20, color: "888888" },
        { text: "Mars 2026", size: 20, color: "888888" },
      ]),
      spacer(),

      // Intro
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        margins: { top: 100, bottom: 200 },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: border(BLUE), bottom: border(BLUE), left: { style: BorderStyle.SINGLE, size: 8, color: BLUE }, right: border(BLUE) },
            shading: { fill: "EEF4FB", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              para("Ce document liste les métriques, graphiques et alertes automatiques que je propose d'afficher dans la plateforme pour chaque type de séance. Pour chaque ligne, coche la case OK si la proposition te convient, ou note ton commentaire dans la colonne à côté. Je m'adapte à tes retours avant de coder.", { size: 21 }),
              spacer(),
              para("Les éléments sont classés par type de séance : Données communes, Séance Endurance, Séance Intervalles, Compétition Triathlon.", { size: 21, color: "555555", italics: true })
            ]
          })]
        })]
      }),

      legendeRow(),

      // ── 1. DONNEES COMMUNES ───────────────────────────────────────────
      h1("1. Données communes à toutes les séances"),
      para("Ces éléments apparaissent sur la fiche de chaque activité, quel que soit le type."),
      spacer(),
      analysisTable([
        ["Métrique", "Sport & date", "Type d'activité (natation / vélo / course à pied / autre), date et heure de départ"],
        ["Métrique", "Durée totale", "Temps total de la séance (hh:mm:ss)"],
        ["Métrique", "Distance totale", "En km, avec 2 décimales"],
        ["Métrique", "FC moyenne / FC max", "Battements par minute, sur l'ensemble de la séance"],
        ["Métrique", "Score de charge MLS", "Calculé à partir de la puissance critique / vitesse critique, modulé par le RPE si saisi. Note : formule à affiner ensemble dans une prochaine étape"],
        ["Métrique", "RPE déclaré", "Valeur saisie par l'athlète sur Nolio (1-10), affichée avec le score de charge"],
        ["Métrique", "Allure ou puissance moyenne", "min/km pour la course, min/100m pour la natation, Watts pour le vélo"],
        ["Graphique", "Courbe FC + allure/puissance", "Deux séries superposées sur l'axe du temps. Courbes colorées par zone %CP-CS (Z1/Z2/Z3) avec lignes horizontales de délimitation des zones. Profil de dénivelé en arrière-plan si données GPS disponibles"],
        ["Graphique", "Tracé GPS", "Tracé coloré selon l'intensité (FC ou allure). Leaflet + OpenFreeMap pour les séances, Mapbox pour les compétitions"],
      ]),

      // ── 2. SEANCE ENDURANCE ───────────────────────────────────────────
      pageBreak(),
      h1("2. Séance Endurance"),
      para("Séances sans structure d'intervalles définis. L'objectif d'analyse est de détecter la dérive cardiaque et d'évaluer la durabilité de l'effort."),
      spacer(),
      analysisTable([
        ["Métrique", "Découplage cardiaque (%)", "Dérive de la FC par rapport à l'allure/puissance sur la 2e moitié de séance vs 1re moitié. Seuil d'alerte à définir avec toi"],
        ["Métrique", "Allure 1re moitié / 2e moitié", "Comparaison des deux demi-séances pour visualiser la progression ou la fatigue"],
        ["Métrique", "FC 1re moitié / 2e moitié", "Même découpage, côté cardiaque"],
        ["Métrique", "Indice de durabilité", "Score calculé à partir du découplage. Comparaison aigue : vs la séance précédente et les 3-4 dernières séances du même type. Comparaison chronique : vs les 4 dernières semaines, 3 derniers mois, 6 derniers mois"],
        ["Graphique", "Graphique découplage visuel", "Courbe FC divisée en deux zones (1re et 2e moitié) avec l'écart mis en évidence"],
        ["Graphique", "Répartition des zones de FC", "Diagramme en barres ou camembert : % du temps passé dans chaque zone (6 zones : Z1i, Z1ii, Z2i, Z2ii, Z3i, Z3ii basées sur %CP-CS)"],
        ["Alerte", "Dérive cardiaque anormale", "Message si le découplage dépasse un seuil - exemple : 'FC en hausse de X% sur la 2e moitié malgré une allure stable - surveiller la récupération'"],
      ]),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE }, right: noBorder },
            shading: { fill: "FEF3E2", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 200, right: 200 },
            children: [
              paraRuns([
                { text: "Zones de FC - Réponse de Karoly : ", bold: true, size: 20, color: GREEN },
              ]),
              para("3 zones principales basées sur %CP-CS :", { size: 19, bold: true }),
              para("Z1 : < LT1 | 55 à 89% CP-CS", { size: 19 }),
              para("Z2 : entre LT1 et LT2 | 90 à 105% CP-CS", { size: 19 }),
              para("Z3 : > LT2 | > 106% CP-CS", { size: 19 }),
              spacer(),
              para("6 sous-zones en utilisant les zones intermédiaires :", { size: 19, bold: true }),
              para("Z1i et Z1ii | Z2i et Z2ii | Z3i et Z3ii", { size: 19 }),
            ]
          })]
        })]
      }),

      // ── 3. SEANCE INTERVALLES ─────────────────────────────────────────
      pageBreak(),
      h1("3. Séance Intervalles"),
      para("Séances avec une structure de répétitions (détectées automatiquement via les LAP Garmin ou l'algorithme signal, ou saisies manuellement)."),
      spacer(),
      analysisTable([
        ["Métrique", "Nombre d'intervalles réalisés", "Comparé au nombre planifié si un plan Nolio est associé"],
        ["Métrique", "Allure (cap/nat) ou puissance (vélo) moyenne des intervalles", "Moyenne pondérée sur l'ensemble des répétitions"],
        ["Métrique", "Allure ou puissance du dernier intervalle", "Indicateur de maintien de la performance en fin de séance"],
        ["Métrique", "FC moyenne des intervalles", "FC moyenne sur les phases de travail uniquement (hors récupération)"],
        ["Métrique", "Allure/puissance planifiée vs réalisée (%)", "Écart entre la cible du plan et la moyenne réalisée"],
        ["Graphique", "Graphique intervalles (double axe)", "Chart double axe par intervalle : vitesse/allure (bleu) + FC (orange). Lignes horizontales en pointillés : CP/CS + LT1 HR et LT2 HR si disponibles pour l'athlète. Sous-graphe HR drift % par intervalle (1re moitié vs 2e moitié en barres groupées)"],
        ["Graphique", "Tableau détaillé par intervalle", "Une ligne par répétition. Colonnes disponibles : pa_hr (allure/puissance par batt.), hr_drift_pct, power_drift_pct, cardiac_cost_hr_per_kmh, cardiac_cost_hr_per_power. Mise en évidence des valeurs hors norme"],
        ["Graphique", "Histogramme cible vs réalisé", "Barres comparant l'allure/puissance planifiée et réalisée pour chaque intervalle"],
        ["Alerte", "Intensité supérieure au plan", "Si la moyenne est X% au-dessus du plan : 'Tu es allé X% plus vite/fort que prévu sur ces intervalles - attention au contrôle de l'intensité'"],
        ["Alerte", "Dégradation en fin de série", "Si l'allure/puissance du dernier intervalle est significativement inférieure au premier : 'Dégradation détectée sur les derniers intervalles - la fatigue a pu impacter la qualité de la séance'"],
      ]),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE }, right: noBorder },
            shading: { fill: "FEF3E2", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 200, right: 200 },
            children: [
              paraRuns([{ text: "Seuils intervalles - Réponse de Karoly : ", bold: true, size: 20, color: GREEN }]),
              para("Pas de seuil fixe à définir par Arthur - les données disponibles dans le tableau par intervalle sont : pa_hr, hr_drift_pct, power_drift_pct, cardiac_cost_hr_per_kmh, cardiac_cost_hr_per_power. Ces métriques permettront de contextualiser l'intensité sans seuil arbitraire.", { size: 19 }),
            ]
          })]
        })]
      }),

      // ── 3b. SEANCES TEMPO ─────────────────────────────────────────────
      pageBreak(),
      h1("3b. Séances Tempo (sous-type d'intervalles)"),
      para("Les séances Tempo et Tempo-Z2/Z3 sont un sous-type de séances d'intervalles identifié automatiquement par la présence de 'Tempo' dans le titre de la séance Nolio. Elles bénéficient d'une analyse spécifique en complément des métriques intervalles standard."),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        margins: { top: 0, bottom: 120 },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: BLUE }, right: noBorder },
            shading: { fill: LBLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 200, right: 200 },
            children: [paraRuns([
              { text: "Détection automatique : ", bold: true, size: 20, color: BLUE },
              { text: "présence de 'Tempo' dans le titre de la séance (ex. : 'Tempo', 'Tempo Z2', 'Tempo Z3'). Une séance peut être à la fois de type Intervalles ET Tempo.", size: 20, color: BLACK }
            ])]
          })]
        })]
      }),
      spacer(),
      analysisTable([
        ["Graphique", "Analyse 4 segments par distance", "Découpage de la séance en 4 périodes égales (par distance). 4 panneaux : (1) FC vs distance par segment avec FC moyenne annotée, (2) Vitesse vs distance par segment avec vitesse moyenne annotée, (3) Ratio FC/Vitesse vs distance par segment, (4) Barres de découplage relatif par période : HR_decoupling, Speed_decoupling, Ratio_decoupling côte à côte"],
        ["Graphique", "Comparaison Phase 1 vs Phase 2", "Découpage en 2 phases égales. 2 panneaux superposés : (1) Vitesse vs distance - courbe Phase 1 (bleu) et Phase 2 (rouge) avec moyennes V1 et V2 tracées en pointillés, (2) FC vs distance - mêmes phases avec moyennes HR1 et HR2 annotées"],
        ["Métrique", "Vitesse moyenne Phase 1 / Phase 2", "V1 et V2 calculées sur chaque demi-séance pour quantifier la progression ou la fatigue"],
        ["Métrique", "FC moyenne Phase 1 / Phase 2", "HR1 et HR2 pour évaluer la dérive cardiaque entre les deux phases"],
        ["Métrique", "Découplage relatif par segment", "HR_decoupling, Speed_decoupling et Ratio_decoupling calculés séparément sur chacun des 4 segments pour localiser où la fatigue apparaît"],
        ["Alerte", "Dégradation progressive sur les segments", "Si le découplage augmente significativement du segment 1 au segment 4 : 'Dégradation progressive détectée - la fatigue s'est installée à partir du segment X'"],
      ]),

      // ── 4. COMPETITION TRIATHLON ──────────────────────────────────────
      pageBreak(),
      h1("4. Compétition Triathlon"),
      para("Activités détectées comme compétitions. Analyse disciplinaire séparée (natation, vélo, course à pied) + transitions."),
      spacer(),
      analysisTable([
        ["Métrique", "Temps total de course", "Temps brut du dossard départ → arrivée"],
        ["Métrique", "Temps par discipline", "Natation, Vélo, Course à pied séparés"],
        ["Métrique", "Durée T1 / T2", "Temps de chaque transition, avec comparaison aux éditions précédentes si disponibles"],
        ["Métrique", "Allure moyenne par discipline", "min/100m (nat), min/km (run). Vélo : puissance moyenne (Watts) ET vitesse moyenne (km/h)"],
        ["Métrique", "FC moyenne par discipline", "FC séparée sur chaque segment pour évaluer l'effort relatif par discipline"],
        ["Métrique", "Découplage par discipline", "Dérive cardiaque calculée séparément sur chaque segment"],
        ["Métrique", "Allure 1re moitié / 2e moitié sur le run", "GAP (Grade Adjusted Pace) normalisé en fonction du dénivelé, du vent et de la température pour une comparaison équitable entre segments"],
        ["Métrique", "Puissance 1re moitié / 2e moitié sur le vélo", "Puissance dissociée selon le contexte (plat, montée, descente) et mise en relation avec la CP correspondante pour chaque segment"],
        ["Graphique", "Timeline de course", "Vue chronologique : natation | T1 | vélo | T2 | run, avec durée et couleur par discipline"],
        ["Graphique", "Courbe FC + allure (nat/run) ou FC + puissance (vélo)", "Un graphique par discipline adapté à la métrique de référence, avec la transition marquée visuellement"],
        ["Graphique", "Comparaison T1/T2 vs éditions précédentes", "Barres de comparaison si d'autres courses du même format sont en base"],
        ["Graphique", "Map Mapbox du tracé", "Tracé complet coloré par intensité, avec les transitions marquées"],
        ["Alerte", "T1 ou T2 long vs références", "Si une transition est significativement plus longue que la moyenne en base : 'T1 de Xmin - X% de plus que ta moyenne sur ce format'"],
        ["Alerte", "Effondrement de l'allure sur le run", "Analyse en 4 segments (par quart de distance) pour IM/Half - la dégradation se produit souvent sur le dernier quart. Alerte si le GAP du segment 4 décroche vs segment 1 : 'Allure ajustée en baisse de X% sur le dernier quart du run'"],
        ["Alerte", "Chute de puissance sur le vélo", "Si la puissance de la 2e moitié du vélo chute significativement vs la 1re : 'Puissance en baisse de X% sur la 2e moitié vélo - fatigue musculaire ou gestion de l'effort à revoir'"],
        ["Graphique", "Analyse segmentée du run (4 panneaux)", "Même logique que l'analyse Tempo, adaptée au run de compétition selon le type : 10km → 4×2,5km | Semi → 4×5,25km | Marathon → 4×10,5km | CàP Tri Half → 4×~5km | CàP Tri IM → 4×~10km. Panneaux : FC / Vitesse GAP / Ratio FC-Vitesse / Découplage relatif par segment"],
        ["Graphique", "Comparaison Phase 1 vs Phase 2 du run", "Même visualisation que Tempo : courbe lissée Phase 1 (bleu) vs Phase 2 (rouge), avec moyennes V1/V2 et HR1/HR2 annotées en pointillés. Adapté à la distance réelle du run selon le format"],
      ]),
      spacer(),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: noBorder, bottom: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE }, right: noBorder },
            shading: { fill: "FEF3E2", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 200, right: 200 },
            children: [paraRuns([
              { text: "Question : ", bold: true, size: 20, color: ORANGE },
              { text: "Y a-t-il d'autres métriques spécifiques au triathlon qui te semblent importantes ? Par exemple l'Index de Puissance Normalisée (NP) sur le vélo, le Variability Index, ou d'autres indicateurs que tu utilises dans ton suivi ?", size: 20, color: BLACK, italics: true }
            ])]
          })]
        })]
      }),

      // ── 5. FICHE SEMAINE / MOIS ───────────────────────────────────────
      pageBreak(),
      h1("5. Fiche récapitulative semaine & mois"),
      para("Rapport automatique accessible pour chaque athlète dans son espace et dans l'espace coach. Exportable en PDF."),
      spacer(),
      analysisTable([
        ["Métrique", "Volume total (km + heures)", "Par sport et au total sur la période"],
        ["Métrique", "Nombre de séances", "Total et répartition par type (endurance / intervalles / compétition)"],
        ["Métrique", "Charge de la période (MLS)", "Somme des scores de charge individuels, avec comparaison vs période précédente"],
        ["Métrique", "Découplage moyen par sport", "Tendance de la durabilité sur la période"],
        ["Métrique", "RPE moyen déclaré", "Perception de l'effort globale sur la semaine ou le mois"],
        ["Graphique", "Répartition du volume par sport", "Camembert ou barres empilées : % natation / vélo / run"],
        ["Graphique", "Évolution de la charge semaine par semaine", "Courbe sur les 4-8 dernières semaines pour visualiser la progression de la charge"],
        ["Graphique", "Heatmap de la semaine", "Calendrier 7 jours avec couleur par intensité de charge - aperçu de la distribution de l'effort"],
        ["Alerte", "Encart 'Focus Coach'", "Apparait si une dérive cardiaque anormale ou une surcharge est détectée sur la période"],
        ["Alerte", "Ratio charge aigue / charge chronique (ACWR)", "Comparaison charge aigue (semaine courante) vs charge chronique (4 semaines glissantes). Charge externe : KM, %CP-CS, Durée. Charge interne : RPE, %LT1, %BTW LT1-LT2, %LT2. Charge globale : MLS et Durée x RPE. Alerte si ACWR > 1.5 (risque de surmenage)"],
      ]),

      spacer(),
      spacer(),

      // ── SECTION FEEDBACK ─────────────────────────────────────────────
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [9026],
        margins: { top: 160, bottom: 0 },
        rows: [new TableRow({
          children: [new TableCell({
            borders: borders(BLUE),
            shading: { fill: LBLUE, type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 280, right: 280 },
            children: [
              para("Tes retours", { bold: true, size: 26, color: BLUE }),
              spacer(),
              para("Pour chaque section, coche les cases 'OK' si la proposition te convient. Pour ce qui ne te convient pas ou que tu veux modifier, note simplement ci-dessous :", { size: 21 }),
              spacer(),
              para("_______________________________________________________________________________________", { size: 20, color: MGREY }),
              spacer(),
              para("_______________________________________________________________________________________", { size: 20, color: MGREY }),
              spacer(),
              para("_______________________________________________________________________________________", { size: 20, color: MGREY }),
              spacer(),
              para("_______________________________________________________________________________________", { size: 20, color: MGREY }),
              spacer(),
              para("_______________________________________________________________________________________", { size: 20, color: MGREY }),
            ]
          })]
        })]
      }),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/laughing-optimistic-galileo/mnt/Dossier de travail /Analyses_Graphiques_Proposition.docx', buffer);
  console.log('Done.');
});
