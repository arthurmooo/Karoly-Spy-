import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Line,
  Circle,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  AthleteKpiReport,
  KpiCard,
  SportDistributionItem,
  WeeklyLoadPoint,
  SportDecouplingItem,
} from "@/services/stats.service";
import type { TextInsight, FocusAlert } from "@/services/analysis.service";
import type { AcwrMetricSnapshot, AcwrStatus } from "@/types/acwr";
import { getDecouplingState } from "@/lib/karolyMetrics";
import { getSportConfig } from "@/lib/constants";

/* ─── colours ─── */
const BLUE = "#2563EB";
const BLUE_LIGHT = "#DBEAFE";
const ORANGE = "#F97316";
const ORANGE_BG = "#FFF7ED";
const ORANGE_BORDER = "#FDBA74";
const SLATE_50 = "#F8FAFC";
const SLATE_100 = "#F1F5F9";
const SLATE_200 = "#E2E8F0";
const SLATE_300 = "#CBD5E1";
const SLATE_500 = "#64748B";
const SLATE_700 = "#334155";
const SLATE_900 = "#0F172A";
const GREEN = "#10B981";
const GREEN_LIGHT = "#D1FAE5";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FEF3C7";
const RED = "#EF4444";
const RED_LIGHT = "#FEE2E2";
const WHITE = "#FFFFFF";

/* ─── sport colours (from centralised SPORT_CONFIG) ─── */
function sportColor(key: string): string {
  return getSportConfig(key).hexColor;
}

/* ─── heatmap gradient (cool → warm like mockup) ─── */
function heatmapColor(ratio: number): string {
  if (ratio <= 0) return SLATE_100;
  if (ratio < 0.3) return "#BFDBFE";   // blue-200
  if (ratio < 0.5) return "#93C5FD";   // blue-300
  if (ratio < 0.65) return "#60A5FA";  // blue-400
  if (ratio < 0.75) return "#F59E0B";  // amber
  if (ratio < 0.85) return "#F97316";  // orange
  return "#EF4444";                     // red
}

/* ─── styles ─── */
const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: SLATE_900,
    backgroundColor: WHITE,
  },

  /* ─ Header ─ */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: `2px solid ${BLUE}`,
  },
  brandTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: SLATE_900 },
  brandSub: { fontSize: 8, color: SLATE_500, marginTop: 2 },
  headerCenter: { alignItems: "center" },
  headerPageTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: SLATE_900, textTransform: "uppercase", letterSpacing: 1 },
  headerRight: { alignItems: "flex-end" },
  athleteName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: SLATE_900 },
  periodText: { fontSize: 8, color: SLATE_500, marginTop: 2 },

  /* ─ Header page 2 (compact) ─ */
  headerCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 6,
    borderBottom: `1px solid ${SLATE_200}`,
  },
  headerCompactLeft: { fontSize: 11, fontFamily: "Helvetica-Bold", color: SLATE_900 },
  headerCompactRight: { fontSize: 8, color: SLATE_500 },

  /* ─ Section titles ─ */
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: SLATE_900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 26,
  },

  /* ─ Coach comment ─ */
  coachBox: {
    backgroundColor: BLUE_LIGHT,
    borderLeft: `3px solid ${BLUE}`,
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
  },
  coachTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coachText: {
    fontSize: 9,
    color: SLATE_700,
    lineHeight: 1.5,
  },

  /* ─ Focus alert ─ */
  focusBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: ORANGE_BG,
    border: `1.5px solid ${ORANGE_BORDER}`,
    borderRadius: 4,
    padding: 12,
    marginBottom: 4,
    gap: 8,
  },
  focusIcon: {
    fontSize: 14,
    color: ORANGE,
    marginTop: -1,
  },
  focusContent: { flex: 1 },
  focusTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  focusMsg: { fontSize: 8, color: SLATE_700, lineHeight: 1.4 },
  focusPill: {
    backgroundColor: ORANGE_BG,
    border: `1px solid ${ORANGE_BORDER}`,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7,
    color: SLATE_700,
  },

  /* ─ KPI cards ─ */
  kpiRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 6,
  },
  kpiCard: {
    flex: 1,
    border: `1px solid ${SLATE_200}`,
    borderRadius: 4,
    overflow: "hidden",
  },
  kpiCardHeader: {
    backgroundColor: BLUE,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kpiCardBody: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: WHITE,
  },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: SLATE_900 },
  kpiDelta: { fontSize: 8, marginTop: 4 },

  /* ─ Distribution bars ─ */
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  distLabel: { width: 75, fontSize: 9, color: SLATE_700 },
  distBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: SLATE_50,
    borderRadius: 2,
    overflow: "hidden",
  },
  distBarFill: { height: 20, borderRadius: 2 },
  distPctBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    backgroundColor: BLUE_LIGHT,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 2,
  },

  /* ─ Chart ─ */
  chartWrap: { marginTop: 4, marginBottom: 4 },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 3,
  },
  chartLabel: { fontSize: 7, color: SLATE_500, textAlign: "center" },

  /* ─ Heatmap ─ */
  heatmapContainer: { marginBottom: 8 },
  heatmapLabelsRow: { flexDirection: "row", gap: 4, marginBottom: 7, paddingHorizontal: 2 },
  heatmapCellsRow: { flexDirection: "row", gap: 4, paddingHorizontal: 2 },
  heatmapLabel: { flex: 1, fontSize: 7, color: SLATE_500, textAlign: "center", fontFamily: "Helvetica-Bold" },
  heatmapCell: {
    flex: 1,
    height: 52,
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  heatmapValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  /* ─ ACWR cards ─ */
  acwrRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  acwrCard: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  acwrCardLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  acwrRatio: { fontSize: 28, fontFamily: "Helvetica-Bold", color: WHITE },
  acwrStatus: { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE, marginTop: 3 },
  acwrNote: { fontSize: 8, color: WHITE, marginTop: 2, opacity: 0.85, textAlign: "center" },

  /* ─ Decoupling table ─ */
  tableContainer: { marginBottom: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottom: `1.5px solid ${SLATE_300}`,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: SLATE_700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottom: `0.5px solid ${SLATE_200}`,
    alignItems: "center",
  },
  tableCellSport: { flex: 2, fontSize: 9, color: SLATE_900 },
  tableCellValue: { flex: 1, fontSize: 9, color: SLATE_700, textAlign: "center" },
  tableCellBadge: { flex: 1, alignItems: "flex-end" },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 14,
    borderRadius: 3,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    minWidth: 55,
  },

  /* ─ Insights ─ */
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  insightDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 1.5,
  },
  insightText: { flex: 1, fontSize: 9, color: SLATE_700, lineHeight: 1.4 },

  /* ─ Footer ─ */
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${SLATE_200}`,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: SLATE_500 },
});

/* ─── Helpers ─── */

function niceRound(max: number): number {
  if (max <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const residual = max / magnitude;
  const nice = residual <= 1.5 ? 1.5 : residual <= 3 ? 3 : residual <= 5 ? 5 : 10;
  return Math.ceil(nice) * magnitude;
}

const INVERSE_KPIS = new Set(["rpe", "decoupling"]);

function deltaStyle(delta: number | null, key?: string): { color: string } {
  if (delta == null) return { color: SLATE_500 };
  const positive = INVERSE_KPIS.has(key ?? "") ? delta <= 0 : delta >= 0;
  return { color: positive ? GREEN : RED };
}

function acwrBg(status: AcwrStatus): string {
  switch (status) {
    case "alert": return RED;
    case "warning": return AMBER;
    case "ok": return GREEN;
    case "low": return BLUE;
    default: return SLATE_200;
  }
}

function acwrStatusLabel(status: AcwrStatus): string {
  switch (status) {
    case "alert": return "Alert";
    case "warning": return "Warning";
    case "ok": return "OK";
    case "low": return "Low";
    default: return "N/A";
  }
}

function decouplingBadge(value: number | null): { bg: string; color: string; label: string } {
  if (value == null) return { bg: SLATE_100, color: SLATE_500, label: "N/A" };
  switch (getDecouplingState(value)) {
    case "good":
      return { bg: GREEN_LIGHT, color: GREEN, label: "Bon" };
    case "moderate":
      return { bg: AMBER_LIGHT, color: AMBER, label: "Modere" };
    case "high":
      return { bg: RED_LIGHT, color: RED, label: "Eleve" };
    default:
      return { bg: SLATE_100, color: SLATE_500, label: "N/A" };
  }
}

const SEVERITY_DOT_COLOR: Record<string, string> = {
  info: GREEN,
  warning: AMBER,
  alert: RED,
};

/* ─── Sub-components ─── */

function FocusCoachBox({ alert }: { alert: FocusAlert }) {
  return (
    <View style={s.focusBox}>
      <Text style={s.focusIcon}>{"\u26A0"}</Text>
      <View style={s.focusContent}>
        <Text style={s.focusTitle}>Focus Coach Attention</Text>
        <Text style={s.focusMsg}>{alert.message}</Text>
        {alert.sessions.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {alert.sessions.map((sess) => (
              <Text key={sess.id} style={s.focusPill}>{sess.name}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function KpiCardsRow({ cards }: { cards: KpiCard[] }) {
  return (
    <View style={s.kpiRow}>
      {cards.map((card) => (
        <View key={card.key} style={s.kpiCard}>
          <View style={s.kpiCardHeader}>
            <Text style={s.kpiLabel}>{card.label}</Text>
          </View>
          <View style={s.kpiCardBody}>
            <Text style={s.kpiValue}>{card.displayValue}</Text>
            <Text style={[s.kpiDelta, deltaStyle(card.deltaPct, card.key)]}>
              {card.deltaDisplay ?? "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DistributionBars({ items }: { items: SportDistributionItem[] }) {
  return (
    <View>
      {items.map((item) => {
        const totalMin = Math.round(item.hours * 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        const timeStr = m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
        return (
          <View key={item.sportKey} style={s.distRow}>
            <Text style={s.distLabel}>{item.label}</Text>
            <View style={s.distBarBg}>
              <View
                style={[
                  s.distBarFill,
                  {
                    width: `${Math.max(item.percent, 3)}%`,
                    backgroundColor: sportColor(item.sportKey),
                  },
                ]}
              />
            </View>
            <View style={{ width: 110, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, paddingLeft: 6 }}>
              <Text style={{ fontSize: 9, color: SLATE_700 }}>{timeStr}</Text>
              <Text style={s.distPctBadge}>{item.percent}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LoadChart({ points }: { points: WeeklyLoadPoint[] }) {
  const W = 480;
  const H = 220;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 15;
  const PAD_B = 5;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (points.length === 0) return null;

  const maxLoad = Math.max(...points.map((p) => p.load), 1);
  const niceMax = niceRound(maxLoad);
  const gridSteps = 4;
  const stepX = chartW / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + chartH - (p.load / niceMax) * chartH,
  }));

  // area fill path (line points + bottom-right + bottom-left)
  const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaD = `${lineD} L ${coords[coords.length - 1]!.x} ${PAD_T + chartH} L ${coords[0]!.x} ${PAD_T + chartH} Z`;

  return (
    <View style={s.chartWrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* horizontal grid lines + Y labels */}
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const val = (niceMax / gridSteps) * i;
          const y = PAD_T + chartH - (val / niceMax) * chartH;
          return (
            <Line
              key={`g${i}`}
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke={SLATE_200}
              strokeWidth={0.5}
            />
          );
        })}
        {/* Y axis labels */}
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const val = Math.round((niceMax / gridSteps) * i);
          const y = PAD_T + chartH - (val / niceMax) * chartH;
          const label = val >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`;
          return (
            <Text
              key={`yl${i}`}
              x={PAD_L - 4}
              y={y + 3}
              style={{ fontSize: 7, color: SLATE_500 }}
              textAnchor="end"
            >
              {label}
            </Text>
          );
        })}
        {/* area fill */}
        <Path d={areaD} fill={BLUE_LIGHT} opacity={0.5} />
        {/* line */}
        {coords.map((c, i) =>
          i < coords.length - 1 ? (
            <Line
              key={`l${i}`}
              x1={c.x}
              y1={c.y}
              x2={coords[i + 1]!.x}
              y2={coords[i + 1]!.y}
              stroke={BLUE}
              strokeWidth={2}
            />
          ) : null,
        )}
        {/* dots */}
        {coords.map((c, i) => (
          <Circle key={`d${i}`} cx={c.x} cy={c.y} r={3.5} fill={BLUE} />
        ))}
      </Svg>
      {/* X labels */}
      <View style={s.chartLabels}>
        {points.map((p) => (
          <Text key={p.weekStart} style={s.chartLabel}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function WeeklyHeatmap({ points }: { points: WeeklyLoadPoint[] }) {
  const maxLoad = Math.max(...points.map((p) => p.load), 1);

  return (
    <View style={s.heatmapContainer}>
      {/* week labels row */}
      <View style={s.heatmapLabelsRow}>
        {points.map((p) => (
          <Text key={`lbl-${p.weekStart}`} style={s.heatmapLabel}>
            {p.label}
          </Text>
        ))}
      </View>
      {/* value cells row */}
      <View style={s.heatmapCellsRow}>
        {points.map((p) => {
          const ratio = p.load / maxLoad;
          const bg = heatmapColor(ratio);
          const textColor = ratio > 0.3 ? WHITE : SLATE_700;
          return (
            <View key={p.weekStart} style={[s.heatmapCell, { backgroundColor: bg }]}>
              <Text style={[s.heatmapValue, { color: textColor }]}>
                {p.load > 0 ? Math.round(p.load) : "—"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AcwrCards({ metrics }: { metrics: AcwrMetricSnapshot[] }) {
  return (
    <View style={s.acwrRow}>
      {metrics.map((m) => {
        const isNA = m.status === "insufficient_data" || m.ratio == null;
        return (
          <View
            key={m.kind}
            style={[s.acwrCard, { backgroundColor: acwrBg(m.status), opacity: isNA ? 0.55 : 1 }]}
          >
            <Text style={[s.acwrCardLabel, isNA ? { color: SLATE_500 } : {}]}>{m.label}</Text>
            <Text style={s.acwrRatio}>
              {m.ratio != null ? m.ratio.toFixed(2) : "—"}
            </Text>
            <Text style={s.acwrStatus}>{acwrStatusLabel(m.status)}</Text>
            <Text style={s.acwrNote}>{m.note}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DecouplingTable({ items }: { items: SportDecouplingItem[] }) {
  return (
    <View style={s.tableContainer}>
      <View style={s.tableHeaderRow}>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Sport</Text>
        <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Découplage moyen</Text>
        <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "right" }]}>État</Text>
      </View>
      {items.map((item) => {
        const bdg = decouplingBadge(item.avgDecoupling);
        return (
          <View key={item.sportKey} style={s.tableBodyRow}>
            <Text style={s.tableCellSport}>{item.label}</Text>
            <Text style={s.tableCellValue}>{item.displayValue}</Text>
            <View style={s.tableCellBadge}>
              <Text
                style={[
                  s.badge,
                  { backgroundColor: bdg.bg, color: bdg.color },
                ]}
              >
                {bdg.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function InsightsList({ insights }: { insights: TextInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <View>
      {insights.map((ins) => (
        <View key={ins.id} style={s.insightRow}>
          <View
            style={[
              s.insightDot,
              { backgroundColor: SEVERITY_DOT_COLOR[ins.severity] ?? SLATE_500 },
            ]}
          />
          <Text style={s.insightText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{ins.title}</Text>
            {ins.detail ? ` ${ins.detail}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Props ─── */

export interface BilanPdfDocumentProps {
  report: AthleteKpiReport;
  athleteName: string;
  acwrMetrics?: AcwrMetricSnapshot[];
  coachComment?: string;
  generatedAt?: Date;
}

/* ─── Main Document ─── */

export function BilanPdfDocument({
  report,
  athleteName,
  acwrMetrics,
  coachComment,
  generatedAt = new Date(),
}: BilanPdfDocumentProps) {
  const dateStr = generatedAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      {/* ═══ PAGE 1 : KPIs + Distribution + Load ═══ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.brandTitle}>KS Endurance</Text>
            <Text style={s.brandSub}>Coaching Triathlon · Karoly Spy</Text>
          </View>
          <View style={s.headerCenter}>
            <Text style={s.headerPageTitle}>Bilan Athlète</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.athleteName}>{athleteName}</Text>
            <Text style={s.periodText}>{report.currentRangeLabel}</Text>
          </View>
        </View>

        {/* Coach comment */}
        {coachComment && coachComment.trim() !== "" && (
          <View style={s.coachBox}>
            <Text style={s.coachTitle}>Mot du Coach</Text>
            <Text style={s.coachText}>{coachComment}</Text>
          </View>
        )}

        {/* Focus Alert */}
        {report.focusAlert && <FocusCoachBox alert={report.focusAlert} />}

        {/* KPI cards */}
        <KpiCardsRow cards={report.cards} />

        {/* Volume distribution */}
        <Text style={s.sectionTitle}>Répartition Volume Par Sport</Text>
        <DistributionBars items={report.distribution} />

        {/* Load evolution */}
        <Text style={s.sectionTitle}>Évolution Charge Hebdomadaire (8 Semaines)</Text>
        <LoadChart points={report.weeklyLoad} />

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Document généré le {dateStr}</Text>
          <Text style={s.footerText}>Page 1/2</Text>
        </View>
      </Page>

      {/* ═══ PAGE 2 : Heatmap + ACWR + Decoupling + Insights ═══ */}
      <Page size="A4" style={s.page}>
        {/* Header compact */}
        <View style={s.headerCompact}>
          <Text style={s.headerCompactLeft}>KS Endurance</Text>
          <Text style={s.headerCompactRight}>
            {athleteName} | {report.currentRangeLabel} | Page 2/2
          </Text>
        </View>

        {/* Heatmap */}
        <Text style={s.sectionTitle}>
          Intensité de la Charge Hebdomadaire (8 Dernières Semaines)
        </Text>
        <WeeklyHeatmap points={report.weeklyLoad} />

        {/* ACWR */}
        {acwrMetrics && acwrMetrics.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Acute:Chronic Workload Ratio (ACWR)</Text>
            <AcwrCards metrics={acwrMetrics} />
          </>
        )}

        {/* Decoupling par sport */}
        {report.sportDecoupling.length > 0 && (
          <>
            <Text style={s.sectionTitle}>
              Decouplage Moyen Par Sport
            </Text>
            <DecouplingTable items={report.sportDecoupling} />
          </>
        )}

        {/* Insights */}
        {report.insights.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Insights & Observations Automatiques</Text>
            <InsightsList insights={report.insights} />
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>contact@ksendurance.com</Text>
          <Text style={s.footerText}>Page 2/2</Text>
        </View>
      </Page>
    </Document>
  );
}
