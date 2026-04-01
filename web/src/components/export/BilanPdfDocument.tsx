import {
  Document,
  Image,
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
  HeatmapCell,
  KpiCard,
  SportDistributionItem,
  VolumeHistoryPoint,
  SportDecouplingItem,
} from "@/services/stats.service";
import type { TextInsight, FocusAlert } from "@/services/analysis.service";
import type { AcwrMetricSnapshot, AcwrStatus } from "@/types/acwr";
import type { HrvPdfSummary } from "@/services/hrv.service";
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
    marginBottom: 8,
    marginTop: 16,
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
  heatmapContainer: { marginBottom: 4 },
  heatmapLabelsRow: { flexDirection: "row", gap: 4, marginBottom: 5, paddingHorizontal: 2 },
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
  acwrRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  acwrCard: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 14,
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
  tableContainer: { marginBottom: 4 },
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
    paddingVertical: 8,
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
    marginBottom: 7,
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

const FOCUS_MAX_PILLS = 3;

function FocusCoachBox({ alert }: { alert: FocusAlert }) {
  const visible = alert.sessions.slice(0, FOCUS_MAX_PILLS);
  const remaining = alert.sessions.length - visible.length;

  return (
    <View style={s.focusBox}>
      <Text style={s.focusIcon}>{"\u26A0"}</Text>
      <View style={s.focusContent}>
        <Text style={s.focusTitle}>Focus Coach Attention</Text>
        <Text style={s.focusMsg}>{alert.message}</Text>
        {visible.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "nowrap", gap: 4, marginTop: 4 }}>
            {visible.map((sess) => (
              <Text key={sess.id} style={s.focusPill}>{sess.name}</Text>
            ))}
            {remaining > 0 && (
              <Text style={[s.focusPill, { fontFamily: "Helvetica-Bold" }]}>
                et +{remaining} autre{remaining > 1 ? "s" : ""}
              </Text>
            )}
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

function VolumeChart({ points }: { points: VolumeHistoryPoint[] }) {
  const W = 480;
  const H = 220;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 15;
  const PAD_B = 5;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (points.length === 0) return null;

  const maxHours = Math.max(...points.map((p) => p.hours), 1);
  const niceMax = niceRound(maxHours);
  const gridSteps = 4;
  const stepX = chartW / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + chartH - (p.hours / niceMax) * chartH,
  }));

  const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaD = `${lineD} L ${coords[coords.length - 1]!.x} ${PAD_T + chartH} L ${coords[0]!.x} ${PAD_T + chartH} Z`;

  function formatHoursLabel(val: number): string {
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    if (h === 0 && m === 0) return "0h";
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, "0")}`;
  }

  return (
    <View style={s.chartWrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
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
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const val = (niceMax / gridSteps) * i;
          const y = PAD_T + chartH - (val / niceMax) * chartH;
          return (
            <Text
              key={`yl${i}`}
              x={PAD_L - 4}
              y={y + 3}
              style={{ fontSize: 7, color: SLATE_500 }}
              textAnchor="end"
            >
              {formatHoursLabel(val)}
            </Text>
          );
        })}
        <Path d={areaD} fill={BLUE_LIGHT} opacity={0.5} />
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
        {coords.map((c, i) => (
          <Circle key={`d${i}`} cx={c.x} cy={c.y} r={3.5} fill={BLUE} />
        ))}
      </Svg>
      <View style={s.chartLabels}>
        {points.map((p, i) => (
          <Text key={`vl-${i}`} style={s.chartLabel}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function HeatmapRow({ cells, title, extraTopMargin }: { cells: HeatmapCell[]; title: string; extraTopMargin?: number }) {
  if (cells.length === 0) return null;
  const maxMls = Math.max(...cells.map((c) => c.mls), 1);

  return (
    <View style={[s.heatmapContainer, extraTopMargin ? { marginTop: extraTopMargin } : {}]}>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE_500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {title}
      </Text>
      {/* labels row */}
      <View style={s.heatmapLabelsRow}>
        {cells.map((c, i) => (
          <Text key={`lbl-${i}`} style={s.heatmapLabel}>
            {c.label}
          </Text>
        ))}
      </View>
      {/* value cells row */}
      <View style={s.heatmapCellsRow}>
        {cells.map((c, i) => {
          const ratio = c.mls / maxMls;
          const bg = heatmapColor(ratio);
          const textColor = ratio > 0.3 ? WHITE : SLATE_700;
          return (
            <View key={`cell-${i}`} style={[s.heatmapCell, { backgroundColor: bg }]}>
              <Text style={[s.heatmapValue, { color: textColor }]}>
                {c.mls > 0 ? Math.round(c.mls) : "\u2014"}
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
        <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "center" }]}>vs précédent</Text>
        <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "right" }]}>État</Text>
      </View>
      {items.map((item) => {
        const bdg = decouplingBadge(item.avgDecoupling);
        // For decoupling, lower is better → negative delta is good
        const deltaColor = item.deltaPct == null
          ? SLATE_500
          : item.deltaPct <= 0 ? GREEN : RED;
        return (
          <View key={item.sportKey} style={s.tableBodyRow}>
            <Text style={s.tableCellSport}>{item.label}</Text>
            <Text style={s.tableCellValue}>{item.displayValue}</Text>
            <Text style={[s.tableCellValue, { color: deltaColor }]}>
              {item.deltaDisplay ?? "\u2014"}
            </Text>
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

function HrvSummaryBox({ summary }: { summary: HrvPdfSummary }) {
  const statusColor: Record<string, string> = {
    within_swc: GREEN,
    above_swc: BLUE,
    below_swc: RED,
    insufficient_data: SLATE_500,
  };
  const statusBg: Record<string, string> = {
    within_swc: GREEN_LIGHT,
    above_swc: BLUE_LIGHT,
    below_swc: RED_LIGHT,
    insufficient_data: SLATE_100,
  };
  const color = statusColor[summary.swcStatus] ?? SLATE_500;
  const bg = statusBg[summary.swcStatus] ?? SLATE_100;

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
      {/* LnRMSSD 7j card */}
      <View style={{ flex: 1, border: `1px solid ${SLATE_200}`, borderRadius: 5, padding: 12 }}>
        <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: SLATE_500, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
          LnRMSSD (moy. 7j)
        </Text>
        <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: SLATE_900 }}>
          {summary.lnRmssd7d != null ? summary.lnRmssd7d.toFixed(2) : "\u2014"}
        </Text>
        {summary.swcMean != null && summary.swcLow != null && summary.swcHigh != null && (
          <Text style={{ fontSize: 7, color: SLATE_500, marginTop: 3 }}>
            SWC : {summary.swcLow.toFixed(2)} — {summary.swcHigh.toFixed(2)} (moy. {summary.swcMean.toFixed(2)})
          </Text>
        )}
      </View>
      {/* FC repos card */}
      <View style={{ flex: 1, border: `1px solid ${SLATE_200}`, borderRadius: 5, padding: 12 }}>
        <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: SLATE_500, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
          FC repos
        </Text>
        <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: SLATE_900 }}>
          {summary.restingHr != null ? `${summary.restingHr} bpm` : "\u2014"}
        </Text>
        <Text style={{ fontSize: 7, color: SLATE_500, marginTop: 3 }}>
          Dernier releve : {summary.date}
        </Text>
      </View>
      {/* SWC status card */}
      <View style={{ flex: 1, backgroundColor: bg, border: `1px solid ${color}`, borderRadius: 5, padding: 12 }}>
        <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
          Statut SWC
        </Text>
        <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color, lineHeight: 1.4 }}>
          {summary.interpretation}
        </Text>
      </View>
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
  hrvSummary?: HrvPdfSummary | null;
  coachComment?: string;
  generatedAt?: Date;
}

/* ─── Main Document ─── */

export function BilanPdfDocument({
  report,
  athleteName,
  acwrMetrics,
  hrvSummary,
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
          <Image src="/ks-logo.png" style={{ width: 100, height: 42 }} />
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

        {/* Volume evolution */}
        <Text style={s.sectionTitle}>
          {report.period === "week"
            ? "Volume Horaire (8 Dernières Semaines)"
            : "Volume Horaire (8 Derniers Mois)"}
        </Text>
        <VolumeChart points={report.volumeHistory} />

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
          <Image src="/ks-logo.png" style={{ width: 60, height: 25 }} />
          <Text style={s.headerCompactRight}>
            {athleteName} | {report.currentRangeLabel} | Page 2/2
          </Text>
        </View>

        {/* Heatmaps */}
        <Text style={s.sectionTitle}>
          {report.period === "week" ? "Répartition de la Charge — Semaine" : "Répartition de la Charge — Mois"}
        </Text>
        <HeatmapRow
          cells={report.detailHeatmap}
          title={report.period === "week" ? "Charge quotidienne (7 jours)" : "Charge hebdomadaire (semaines du mois)"}
        />
        <HeatmapRow
          cells={report.comparisonHeatmap}
          title={report.period === "week" ? "Comparaison — 4 dernières semaines" : "Comparaison — 4 derniers mois"}
          extraTopMargin={6}
        />

        {/* ACWR */}
        {acwrMetrics && acwrMetrics.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Acute:Chronic Workload Ratio (ACWR)</Text>
            <AcwrCards metrics={acwrMetrics} />
          </>
        )}

        {/* HRV / Readiness */}
        {hrvSummary && (
          <>
            <Text style={s.sectionTitle}>Suivi HRV & Readiness</Text>
            <HrvSummaryBox summary={hrvSummary} />
          </>
        )}

        {/* Decoupling par sport — course & vélo uniquement */}
        {(() => {
          const filtered = report.sportDecoupling.filter(
            (item) => item.sportKey === "CAP" || item.sportKey === "VELO"
          );
          return filtered.length > 0 ? (
            <>
              <Text style={s.sectionTitle}>
                Decouplage Moyen Par Sport
              </Text>
              <DecouplingTable items={filtered} />
            </>
          ) : null;
        })()}

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
