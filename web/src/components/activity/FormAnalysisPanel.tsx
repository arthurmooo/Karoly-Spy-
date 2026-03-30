import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Disclosure, DisclosureTrigger, DisclosureContent, useDisclosureContext } from "@/components/ui/Disclosure";
import { Icon } from "@/components/ui/Icon";
import type { FormAnalysis, FormGlobalDecision, FormModuleDecision } from "@/types/activity";

type DecisionKey = FormGlobalDecision | FormModuleDecision | "unknown";

// ─── Decision metadata ──────────────────────────────────────────────────────

export const DECISION_META: Record<DecisionKey, {
  label: string;
  variant: "emerald" | "amber" | "red" | "slate";
  icon: string;
  description: string;
}> = {
  amelioration:            { label: "Amélioration",            variant: "emerald", icon: "trending_up",     description: "Forme en progression : FC en baisse, RPE en baisse, allure stable." },
  fatigue_stress:          { label: "Fatigue / stress",         variant: "amber",   icon: "warning",         description: "Signaux de fatigue détectés : FC ou découplage en hausse vs historique." },
  signal_alarme:           { label: "Signal d'alarme",          variant: "red",     icon: "crisis_alert",    description: "Dégradation marquée de la forme. Recommander une récupération." },
  stable:                  { label: "Stable",                   variant: "slate",   icon: "horizontal_rule", description: "Indicateurs stables dans la plage normale pour cet athlète." },
  historique_insuffisant:  { label: "Historique insuffisant",   variant: "slate",   icon: "history",         description: "Pas assez de séances comparables pour produire une analyse fiable." },
  amelioration_fragile:    { label: "Amélioration fragile",     variant: "amber",   icon: "trending_up",     description: "Amélioration partielle, à confirmer sur les prochaines séances." },
  fatigue_confirmee:       { label: "Fatigue confirmée",        variant: "red",     icon: "sick",            description: "Fatigue persistante confirmée sur plusieurs séances récentes." },
  alerte_renforcee:        { label: "Alerte renforcée",         variant: "red",     icon: "crisis_alert",    description: "Signal d'alarme renforcé : plusieurs indicateurs en dégradation simultanée." },
  progression_tempo:       { label: "Progression tempo",        variant: "emerald", icon: "bolt",            description: "Efficience aérobie en hausse, découplage stable — progression en endurance." },
  degradation_tendance:    { label: "Dégradation tendance",     variant: "red",     icon: "trending_down",   description: "Tendance à la dégradation sur les dernières séances." },
  progression_intervalles: { label: "Progression intervalles",  variant: "emerald", icon: "fitness_center",  description: "Performance en intervalles en progression vs historique." },
  fatigue_intervalles:     { label: "Fatigue intervalles",      variant: "amber",   icon: "warning",         description: "Baisse de performance détectée sur les intervalles." },
  alerte_intervalles:      { label: "Alerte intervalles",       variant: "red",     icon: "crisis_alert",    description: "Dégradation importante sur les intervalles. Charge à réduire." },
  unknown:                 { label: "Analyse",                  variant: "slate",   icon: "analytics",       description: "Analyse en cours." },
};

// ─── Reason translations ─────────────────────────────────────────────────────

export const REASON_LABELS: Record<string, string> = {
  dec_up:                               "Découplage en hausse vs historique",
  ea_down_rpe_flat:                     "Efficience aérobie en baisse, RPE stable",
  ea_up_dec_stable:                     "Efficience en hausse, découplage stable",
  hrcorr_down_rpe_down_output_stable:   "FC corrigée et RPE en baisse, allure stable",
  hrcorr_up_no_rpe:                     "FC corrigée en hausse (RPE non disponible)",
  hrcorr_up_rpe_up:                     "FC corrigée et RPE en hausse",
  ea_down_or_hrend_up_with_rpe:         "Efficience en baisse ou dérive FC en fin de séance",
  hrend_up:                             "Dérive cardiaque élevée en fin de séance",
  output_drift:                         "Allure fluctuante pendant l'effort",
  slope_normalization_unavailable:      "Correction de pente non disponible",
  drift_corr_unavailable:               "Correction de dérive non disponible",
  historique_insuffisant:               "Historique insuffisant",
  rpe_up_no_metric_change:              "RPE en hausse sans dégradation des métriques",
  no_baseline:                          "Aucune référence disponible",
  durability_flag:                      "Flag de durabilité activé",
};

function translateReason(raw: string): string {
  return REASON_LABELS[raw] ?? raw.replace(/_/g, " ");
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function fmtDelta(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtNorm(value: string | null | undefined): string {
  const map: Record<string, string> = {
    gap_speed_native_grade: "GAP grade natif",
    gap_speed_derived_grade: "GAP grade dérivé",
    speed_fallback_no_grade: "Speed fallback",
    speed: "Speed",
    power: "Power",
  };
  return (value && map[value]) ?? value ?? "—";
}

function fmtGradeSource(value: string | null | undefined): string {
  const map: Record<string, string> = {
    native_fit: "FIT natif",
    derived_altitude_distance: "Altitude + distance",
    speed_fallback: "Fallback speed",
  };
  return (value && map[value]) ?? value ?? "—";
}

// ─── Color helpers ───────────────────────────────────────────────────────────

export function deltaColor(value: number | null | undefined, invert = false): string {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.5) return "";
  const positive = invert ? value < 0 : value > 0;
  return positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
}

function deltaColorPct(value: number | null | undefined, invert = false): string {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 1.0) return "";
  return deltaColor(value, invert);
}

// ─── InfoTip ─────────────────────────────────────────────────────────────────

const TOOLTIP_W = 208; // w-52 = 13rem = 208px
const TOOLTIP_GAP = 8;

export function InfoTip({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const idealLeft = r.left + r.width / 2 - TOOLTIP_W / 2;
    const clampedLeft = Math.min(Math.max(TOOLTIP_GAP, idealLeft), window.innerWidth - TOOLTIP_W - TOOLTIP_GAP);
    const arrowLeft = r.left + r.width / 2 - clampedLeft;
    setPos({ top: r.top - TOOLTIP_GAP, left: clampedLeft, arrowLeft });
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setPos(null), 120);
  }, []);

  const keepOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        className="inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 text-[9px] font-bold text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all leading-none select-none"
        aria-label="Info"
        type="button"
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
      >
        i
      </button>
      {pos &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-auto"
            style={{ top: pos.top, left: pos.left, transform: "translateY(-100%)", width: TOOLTIP_W }}
            onMouseEnter={keepOpen}
            onMouseLeave={scheduleClose}
          >
            <div className="rounded-md bg-slate-900 dark:bg-slate-800 border border-slate-700 px-3 py-2 text-[11px] leading-snug text-slate-200 shadow-xl">
              {text}
              <div
                className="absolute top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800"
                style={{ left: pos.arrowLeft, transform: "translateX(-50%)" }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaColorClass?: string;
  tooltip: string;
  highlight?: boolean;
}

function KpiCard({ label, value, delta, deltaColorClass = "", tooltip, highlight = false }: KpiCardProps) {
  return (
    <div className={`relative flex flex-col gap-1 rounded-lg border px-3.5 py-3 transition-colors
      ${highlight
        ? "border-blue-200 bg-blue-50/60 dark:border-blue-800/60 dark:bg-blue-950/20"
        : "border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-900/50"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <InfoTip text={tooltip} />
      </div>
      <p className="text-xl font-semibold leading-tight text-slate-900 dark:text-white tabular-nums">
        {value}
      </p>
      {delta != null && (
        <p className={`text-[11px] font-medium leading-none tabular-nums ${deltaColorClass || "text-slate-400"}`}>
          Δ {delta}
        </p>
      )}
    </div>
  );
}

// ─── Compact row ─────────────────────────────────────────────────────────────

function CompactRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{value}</span>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{value}</p>
    </div>
  );
}

// ─── Decision colors ─────────────────────────────────────────────────────────

// Re-exported for backward-compat with SessionComparisonPage
export const DECISION_BORDER_COLOR: Record<string, string> = {
  emerald: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
  amber:   "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  red:     "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
  slate:   "border-l-slate-400 bg-slate-50/50 dark:bg-slate-800/30",
};

const DECISION_CALLOUT: Record<string, string> = {
  emerald: "border-emerald-400 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-300",
  amber:   "border-amber-400 bg-amber-50/70 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300",
  red:     "border-red-400 bg-red-50/70 text-red-800 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300",
  slate:   "border-slate-300 bg-slate-50/70 text-slate-600 dark:bg-slate-800/40 dark:border-slate-600 dark:text-slate-400",
};

// ─── Comparison mode label ────────────────────────────────────────────────────

function comparisonModeLabel(mode: string | null | undefined, count: number | null | undefined): string {
  const n = count ?? 0;
  if (mode === "beta_regression") return `${n} séances · régression temp.`;
  if (mode === "same_temp_bin")   return `${n} séances · même plage temp.`;
  return `${n} séances comparables`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FormAnalysisPanel({ formAnalysis }: { formAnalysis: FormAnalysis }) {
  const finalKey = formAnalysis.decision?.final ?? formAnalysis.decision?.module ?? formAnalysis.decision?.global ?? "unknown";
  const meta = DECISION_META[finalKey as DecisionKey] ?? DECISION_META.unknown;
  const isIntervals = formAnalysis.module === "intervals";
  const decLabel = formAnalysis.decoupling?.metric === "dec_int_pct" ? "Dec int." : "Découplage";

  const reasons = formAnalysis.decision?.reasons?.filter(r => r !== "historique_insuffisant") ?? [];

  return (
    <div className="space-y-4">

      {/* ── Header: decision + metadata ────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg
            ${meta.variant === "emerald" ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            : meta.variant === "amber"   ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
            : meta.variant === "red"     ? "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
          >
            <Icon name={meta.icon} className="text-[20px]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
              {isIntervals ? "Analyse intervalles" : "Analyse endurance"}
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{meta.label}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {formAnalysis.decision?.durability_flag && (
            <Badge variant="amber">Flag durabilité</Badge>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1">
            <Icon name="compare" className="text-[14px] text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {comparisonModeLabel(formAnalysis.comparison_mode, formAnalysis.comparable_count)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Reasons callout ─────────────────────────────────────────────── */}
      {reasons.length > 0 && (
        <div className={`rounded-lg border-l-[3px] px-4 py-2.5 ${DECISION_CALLOUT[meta.variant]}`}>
          <ul className="space-y-0.5">
            {reasons.map((r, i) => (
              <li key={`${r}-${i}`} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 shrink-0">›</span>
                <span>{translateReason(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
          Métriques clés
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">

          {/* EA */}
          <KpiCard
            label="EA"
            value={fmt(formAnalysis.ea?.today, 3)}
            delta={fmtPct(formAnalysis.ea?.delta_pct)}
            deltaColorClass={deltaColorPct(formAnalysis.ea?.delta_pct)}
            tooltip="Efficience Aérobie = output ÷ FC. Mesure la quantité d'effort produit par battement. Plus c'est élevé, meilleure est la forme aérobie."
          />

          {/* Découplage */}
          <KpiCard
            label={decLabel}
            value={fmtPct(formAnalysis.decoupling?.today, 1)}
            delta={fmtDelta(formAnalysis.decoupling?.delta, 1, "%")}
            deltaColorClass={deltaColor(formAnalysis.decoupling?.delta, true)}
            tooltip="Dérive de la FC à allure constante (%). Une valeur proche de 0% indique une bonne résistance à la fatigue. Au-delà de +5%, la fatigue s'accumule."
          />

          {/* FC corrigée */}
          <KpiCard
            label="FC corrigée"
            value={fmt(formAnalysis.temperature?.hr_corr, 1, " bpm")}
            delta={fmtDelta(formAnalysis.temperature?.delta_hr_corr, 1, " bpm")}
            deltaColorClass={deltaColor(formAnalysis.temperature?.delta_hr_corr, true)}
            tooltip="Fréquence cardiaque ajustée selon la température du jour (bpm). Permet de comparer des séances par temps chaud ou froid sur la même base."
          />

          {/* RPE */}
          <KpiCard
            label="RPE"
            value={fmt(formAnalysis.rpe?.today, 1)}
            delta={fmtDelta(formAnalysis.rpe?.delta, 1)}
            deltaColorClass={deltaColor(formAnalysis.rpe?.delta, true)}
            tooltip="Effort perçu déclaré par l'athlète (échelle 1–10). Permet de détecter une dissociation entre les métriques cardiaques et la sensation de fatigue."
          />

          {/* Output */}
          <KpiCard
            label="Output"
            value={fmt(
              formAnalysis.output?.mean,
              1,
              formAnalysis.output?.unit ? ` ${formAnalysis.output.unit}` : ""
            )}
            delta={fmtPct(formAnalysis.output?.delta_pct)}
            deltaColorClass={deltaColorPct(formAnalysis.output?.delta_pct)}
            tooltip="Allure ou puissance moyenne sur le segment stable analysé. Le Δ indique l'écart à la vitesse moyenne sur les séances comparables."
          />
        </div>
      </div>

      {/* ── Dérive fin de séance ─────────────────────────────────────────── */}
      {formAnalysis.hrend_drift?.today != null && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Durabilité
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <KpiCard
              label="Dérive FC fin"
              value={fmt(formAnalysis.hrend_drift.today, 1, " bpm")}
              delta={fmtDelta(formAnalysis.hrend_drift.delta, 1, " bpm")}
              deltaColorClass={deltaColor(formAnalysis.hrend_drift.delta, true)}
              tooltip="Élévation de la FC en fin de séance par rapport au début à output constant (bpm). Indicateur de fatigabilité musculaire et cardiaque sur la durée."
            />
          </div>
        </div>
      )}

      {/* ── Contexte ─────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
          Contexte
        </p>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-800 px-3.5 py-0.5">
          <CompactRow
            label="Temp. séance"
            value={fmt(formAnalysis.temperature?.temp, 1, " °C")}
            tooltip="Température mesurée pendant la séance (source : montre ou météo)."
          />
          <CompactRow
            label="Temp. référence"
            value={fmt(formAnalysis.temperature?.tref, 1, " °C")}
            tooltip="Température de référence utilisée pour la correction. Déduite des séances comparables ou de la régression."
          />
          <CompactRow
            label="Beta FC/temp"
            value={fmt(formAnalysis.temperature?.beta_hr, 3, " bpm/°C")}
            tooltip="Sensibilité de la FC à la température pour cet athlète (bpm par °C). Calculée par régression sur l'historique."
          />
          <CompactRow
            label="Lieu"
            value={formAnalysis.environment?.location ?? "—"}
          />
          {formAnalysis.stable_segment && (
            <CompactRow
              label="Segment stable"
              value={`${formAnalysis.stable_segment.window_label ?? "—"} · ${formAnalysis.stable_segment.selected_points ?? 0} pts`}
              tooltip="Fenêtre temporelle extraite pour l'analyse. Seuls les points à allure stable y sont retenus."
            />
          )}
        </div>
      </div>

      {/* ── Gabarit de comparaison ───────────────────────────────────────── */}
      {formAnalysis.template_key && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Gabarit</span>
          {formAnalysis.template_key.split("|").filter(Boolean).map((part, i) => (
            <span
              key={i}
              className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
            >
              {part}
            </span>
          ))}
          <InfoTip text="Identifiant du type de séance utilisé pour filtrer les séances comparables. Regroupe le sport, le type d'effort et l'environnement." />
        </div>
      )}

      {/* ── Détails techniques (collapsed) ──────────────────────────────── */}
      <Disclosure defaultOpen={false}>
        <DisclosureTrigger className="group flex items-center gap-1.5 rounded px-1 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <TechnicalChevron />
          <span>Détails techniques</span>
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="mt-1 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3 py-1.5 divide-y divide-slate-100 dark:divide-slate-800">
            <MiniRow label="Terrain" value={formAnalysis.environment?.terrain ?? "—"} />
            <MiniRow label="Mode comparaison" value={formAnalysis.comparison_mode ?? "—"} />
            <MiniRow label="Confiance" value={formAnalysis.confidence != null ? `${Math.round(formAnalysis.confidence * 100)}%` : "—"} />
            <MiniRow label="Normalisation" value={fmtNorm(formAnalysis.output?.normalization)} />
            <MiniRow label="Source pente" value={fmtGradeSource(formAnalysis.output?.grade_source)} />
            <MiniRow label="Qualité pente" value={formAnalysis.output?.grade_quality ?? "—"} />
            <MiniRow label="Couverture pente" value={formAnalysis.output?.grade_coverage_pct != null ? `${(formAnalysis.output.grade_coverage_pct * 100).toFixed(0)}%` : "—"} />
            <MiniRow label="Version SOT" value={formAnalysis.version ?? "—"} />
          </div>
        </DisclosureContent>
      </Disclosure>

    </div>
  );
}

function TechnicalChevron() {
  const { isOpen } = useDisclosureContext();
  return (
    <Icon
      name="chevron_right"
      className={`text-[16px] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
    />
  );
}
