import type { NormalizedStatsActivity } from "@/services/stats.service";
import { isDecouplingAlert } from "@/lib/karolyMetrics";

export interface TextInsight {
  id: string;
  icon: string;
  severity: "info" | "warning" | "alert";
  title: string;
  detail?: string;
}

export interface FocusAlertSession {
  id: string;
  name: string;
  sportKey: string;
}

export interface FocusAlert {
  title: string;
  message: string;
  sessions: FocusAlertSession[];
}

export interface AnalysisResult {
  insights: TextInsight[];
  focusAlert: FocusAlert | null;
}

const ONE_DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const SIGNED_ONE_DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "always",
});

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function deltaPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function generateInsights(
  currentRows: NormalizedStatsActivity[],
  previousRows: NormalizedStatsActivity[]
): AnalysisResult {
  const insights: TextInsight[] = [];

  // --- Volume delta ---
  const curDist = currentRows.reduce((s, r) => s + r.distanceM, 0) / 1000;
  const prevDist = previousRows.reduce((s, r) => s + r.distanceM, 0) / 1000;
  const volDelta = deltaPct(curDist, prevDist);
  if (volDelta != null && Math.abs(volDelta) > 20) {
    const dir = volDelta > 0 ? "hausse" : "baisse";
    insights.push({
      id: "volume-delta",
      icon: volDelta > 0 ? "trending_up" : "trending_down",
      severity: Math.abs(volDelta) > 40 ? "warning" : "info",
      title: `Volume en ${dir} de ${ONE_DECIMAL.format(Math.abs(volDelta))}% vs période précédente`,
    });
  }

  // --- Charge MLS ---
  const curLoad = currentRows.reduce((s, r) => s + (r.loadIndex ?? 0), 0);
  const prevLoad = previousRows.reduce((s, r) => s + (r.loadIndex ?? 0), 0);
  const loadDelta = deltaPct(curLoad, prevLoad);
  if (loadDelta != null && loadDelta > 30) {
    insights.push({
      id: "load-high",
      icon: "local_fire_department",
      severity: "warning",
      title: `Charge totale élevée : ${SIGNED_ONE_DECIMAL.format(loadDelta)}% vs période précédente`,
    });
  }

  // --- Découplage moyen ---
  const curDecValues = currentRows.map((r) => r.decouplingIndex).filter((v): v is number => v != null);
  const avgDec = mean(curDecValues);
  if (avgDec != null && avgDec > 10) {
    insights.push({
      id: "decoupling-high",
      icon: "heart_broken",
      severity: "warning",
      title: `Découplage moyen élevé (${ONE_DECIMAL.format(avgDec)}%) — signe de fatigue cardiaque`,
    });
  }

  // --- Bon couplage ---
  if (avgDec != null && avgDec < 3 && curDecValues.length >= 2) {
    insights.push({
      id: "decoupling-good",
      icon: "favorite",
      severity: "info",
      title: `Excellent couplage FC/allure (${ONE_DECIMAL.format(avgDec)}%)`,
    });
  }

  // --- Découplage delta ---
  const prevDecValues = previousRows.map((r) => r.decouplingIndex).filter((v): v is number => v != null);
  const prevAvgDec = mean(prevDecValues);
  if (avgDec != null && prevAvgDec != null) {
    const decDelta = avgDec - prevAvgDec;
    if (Math.abs(decDelta) > 3) {
      const dir = decDelta > 0 ? "hausse" : "baisse";
      insights.push({
        id: "decoupling-delta",
        icon: "monitor_heart",
        severity: "info",
        title: `Découplage en ${dir} de ${SIGNED_ONE_DECIMAL.format(decDelta)} pts vs période précédente`,
      });
    }
  }

  // --- Durabilité ---
  const durValues = currentRows.map((r) => r.durabilityIndex).filter((v): v is number => v != null);
  const avgDur = mean(durValues);
  if (avgDur != null && avgDur > 1.1) {
    insights.push({
      id: "durability-penalty",
      icon: "battery_alert",
      severity: "warning",
      title: `Penalite de durabilite elevee (${ONE_DECIMAL.format(avgDur)}) — cout cardiaque accru en fin de seance`,
    });
  }

  // --- RPE moyen ---
  const curRpeValues = currentRows.map((r) => r.rpe).filter((v): v is number => v != null);
  const avgRpe = mean(curRpeValues);
  if (avgRpe != null && avgRpe > 7) {
    insights.push({
      id: "rpe-high",
      icon: "sentiment_stressed",
      severity: "warning",
      title: `Perception d'effort élevée (RPE ${ONE_DECIMAL.format(avgRpe)})`,
    });
  }

  // --- RPE delta ---
  const prevRpeValues = previousRows.map((r) => r.rpe).filter((v): v is number => v != null);
  const prevAvgRpe = mean(prevRpeValues);
  if (avgRpe != null && prevAvgRpe != null) {
    const rpeDelta = avgRpe - prevAvgRpe;
    if (Math.abs(rpeDelta) > 1) {
      const dir = rpeDelta > 0 ? "hausse" : "baisse";
      insights.push({
        id: "rpe-delta",
        icon: "speed",
        severity: "info",
        title: `RPE en ${dir} de ${SIGNED_ONE_DECIMAL.format(rpeDelta)} pts`,
      });
    }
  }

  // --- Sessions count ---
  if (currentRows.length > 0 && currentRows.length < 3) {
    insights.push({
      id: "sessions-low",
      icon: "event_busy",
      severity: "info",
      title: `Seulement ${currentRows.length} séance${currentRows.length > 1 ? "s" : ""} cette période — récupération ?`,
    });
  }

  // --- Decouplage Karoly (FocusAlert) ---
  const driftSessions: FocusAlertSession[] = [];
  for (const row of currentRows) {
    if (isDecouplingAlert(row.decouplingIndex)) {
      driftSessions.push({
        id: row.activityId,
        name: row.activityName || `${row.sportLabel} — ${row.sessionDate.toLocaleDateString("fr-FR")}`,
        sportKey: row.sportKey,
      });
    }
  }

  let focusAlert: FocusAlert | null = null;
  if (driftSessions.length > 0) {
    insights.push({
      id: "drift-alert",
      icon: "warning",
      severity: "alert",
      title: `Decouplage > 5% detecte sur ${driftSessions.length} seance${driftSessions.length > 1 ? "s" : ""}`,
    });
    focusAlert = {
      title: "Alerte decouplage",
      message: `${driftSessions.length} seance${driftSessions.length > 1 ? "s presentent" : " presente"} un decouplage superieur a 5%. Cela peut indiquer un cout interne accru, de la fatigue ou une hydratation insuffisante.`,
      sessions: driftSessions,
    };
  }

  return { insights, focusAlert };
}
