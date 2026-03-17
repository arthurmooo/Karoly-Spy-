import { Badge } from "@/components/ui/Badge";
import { Disclosure, DisclosureTrigger, DisclosureContent, useDisclosureContext } from "@/components/ui/Disclosure";
import { Icon } from "@/components/ui/Icon";
import type { FormAnalysis, FormGlobalDecision, FormModuleDecision } from "@/types/activity";

type DecisionKey = FormGlobalDecision | FormModuleDecision | "unknown";

const DECISION_META: Record<DecisionKey, { label: string; variant: "emerald" | "amber" | "red" | "slate" }> = {
  amelioration: { label: "Amelioration", variant: "emerald" },
  fatigue_stress: { label: "Fatigue / stress", variant: "amber" },
  signal_alarme: { label: "Signal d'alarme", variant: "red" },
  stable: { label: "Stable", variant: "slate" },
  historique_insuffisant: { label: "Historique insuffisant", variant: "slate" },
  amelioration_fragile: { label: "Amelioration fragile", variant: "amber" },
  fatigue_confirmee: { label: "Fatigue confirmee", variant: "red" },
  alerte_renforcee: { label: "Alerte renforcee", variant: "red" },
  progression_tempo: { label: "Progression tempo", variant: "emerald" },
  degradation_tendance: { label: "Degradation tendance", variant: "red" },
  progression_intervalles: { label: "Progression intervalles", variant: "emerald" },
  fatigue_intervalles: { label: "Fatigue intervalles", variant: "amber" },
  alerte_intervalles: { label: "Alerte intervalles", variant: "red" },
  unknown: { label: "Analyse", variant: "slate" },
};

const DECISION_BORDER_COLOR: Record<string, string> = {
  emerald: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
  amber: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  red: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
  slate: "border-l-slate-400 bg-slate-50/50 dark:bg-slate-800/30",
};

// --- Formatters ---

function fmt(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtNorm(value: string | null | undefined): string {
  const map: Record<string, string> = {
    gap_speed_native_grade: "GAP grade natif",
    gap_speed_derived_grade: "GAP grade derive",
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

function deltaColor(value: number | null | undefined, invert = false): string {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.5) return "text-slate-900 dark:text-white";
  const positive = invert ? value < 0 : value > 0;
  return positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

// --- Stat renderers ---

function stat(label: string, value: string, colorClass?: string) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold break-words ${colorClass ?? "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function statCompact(label: string, value: string) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-sm border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-900/30">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{value}</p>
    </div>
  );
}

function statMini(label: string, value: string) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-2 py-1">
      <p className="text-[10px] tracking-wider text-slate-400">{label}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{value}</p>
    </div>
  );
}

// --- Main component ---

export function FormAnalysisPanel({ formAnalysis }: { formAnalysis: FormAnalysis }) {
  const finalKey = formAnalysis.decision?.final ?? formAnalysis.decision?.module ?? formAnalysis.decision?.global ?? "unknown";
  const meta = DECISION_META[finalKey];
  const moduleLabel = formAnalysis.module === "intervals" ? "Module intervalles" : "Module tempo continu";
  const decLabel = formAnalysis.decoupling?.metric === "dec_int_pct" ? "Dec int" : "Dec";

  return (
    <div className="space-y-5">
      {/* ── Tier 1: Decision ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">{moduleLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{meta.label}</h3>
          <p className="text-sm text-slate-500">
            Template {formAnalysis.template_key ?? "—"} · {formAnalysis.comparison_mode ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {formAnalysis.decision?.durability_flag && <Badge variant="amber">Flag durabilite</Badge>}
        </div>
      </div>

      {/* Reasons callout — promoted to right under the decision */}
      {formAnalysis.decision?.reasons?.length ? (
        <div className={`rounded-sm border-l-4 px-4 py-3 ${DECISION_BORDER_COLOR[meta.variant] ?? DECISION_BORDER_COLOR.slate}`}>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {formAnalysis.decision.reasons.map((reason, i) => (
              <li key={`${reason}-${i}`}>- {reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Tier 2: Key metrics ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Metriques cles</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stat("Output", fmt(formAnalysis.output?.mean, 1, formAnalysis.output?.unit ? ` ${formAnalysis.output.unit}` : ""))}
          {stat("Delta output", fmtPct(formAnalysis.output?.delta_pct), deltaColor(formAnalysis.output?.delta_pct))}
          {stat("EA", fmt(formAnalysis.ea?.today, 3))}
          {stat("Delta EA", fmtPct(formAnalysis.ea?.delta_pct), deltaColor(formAnalysis.ea?.delta_pct))}
          {stat(decLabel, fmtPct(formAnalysis.decoupling?.today))}
          {stat(`Delta ${decLabel}`, fmtPct(formAnalysis.decoupling?.delta), deltaColor(formAnalysis.decoupling?.delta, true))}
          {stat("HRend drift", fmt(formAnalysis.hrend_drift?.today, 1, " bpm"))}
          {stat("Delta RPE", fmt(formAnalysis.rpe?.delta, 1), deltaColor(formAnalysis.rpe?.delta, true))}
        </div>
      </div>

      {/* ── Tier 3: Context & corrections ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Contexte</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {statCompact("Comparables", formAnalysis.comparable_count != null ? String(formAnalysis.comparable_count) : "—")}
          {statCompact("Lieu", formAnalysis.environment?.location ?? "—")}
          {statCompact("Temp", fmt(formAnalysis.temperature?.temp, 1, " °C"))}
          {statCompact("Tref", fmt(formAnalysis.temperature?.tref, 1, " °C"))}
          {statCompact("Beta HR", fmt(formAnalysis.temperature?.beta_hr, 3, " bpm/°C"))}
          {statCompact("HR corr", fmt(formAnalysis.temperature?.hr_corr, 1, " bpm"))}
        </div>

        {formAnalysis.stable_segment && (
          <div className="mt-2 rounded-sm border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/30 dark:text-slate-400">
            Segment stable {formAnalysis.stable_segment.window_label ?? "—"} · {formAnalysis.stable_segment.selected_points ?? 0} points gardes
          </div>
        )}

        {formAnalysis.rep_windows?.length ? (
          <div className="mt-2 rounded-sm border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-900/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fenetres stabilisees</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {formAnalysis.rep_windows.map((w) => (
                <div key={w.rep_index} className="rounded-sm border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950/40">
                  <p className="font-semibold text-slate-900 dark:text-white">Rep {w.rep_index}</p>
                  <p className="text-slate-500">HR corr {fmt(w.hr_corr, 1, " bpm")} · Output {fmt(w.output, 1)} · EA {fmt(w.ea, 3)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Tier 4: Technical details (collapsed) ── */}
      <Disclosure defaultOpen={false}>
        <DisclosureTrigger className="group flex items-center gap-1.5 rounded-sm px-1 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <TechnicalChevron />
          <span>Details techniques</span>
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {statMini("Terrain", formAnalysis.environment?.terrain ?? "—")}
            {statMini("Confiance", formAnalysis.confidence != null ? `${Math.round(formAnalysis.confidence * 100)}%` : "—")}
            {statMini("Normalisation", fmtNorm(formAnalysis.output?.normalization))}
            {statMini("Source pente", fmtGradeSource(formAnalysis.output?.grade_source))}
            {statMini("Qualite pente", formAnalysis.output?.grade_quality ?? "—")}
            {statMini("Couverture pente", fmtPct(formAnalysis.output?.grade_coverage_pct != null ? formAnalysis.output.grade_coverage_pct * 100 : null))}
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
