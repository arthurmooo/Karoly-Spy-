import { Badge } from "@/components/ui/Badge";
import { Disclosure, DisclosureTrigger, DisclosureContent, useDisclosureContext } from "@/components/ui/Disclosure";
import { Icon } from "@/components/ui/Icon";
import type { FormAnalysis, FormGlobalDecision, FormModuleDecision } from "@/types/activity";

type DecisionKey = FormGlobalDecision | FormModuleDecision | "unknown";

export const DECISION_META: Record<DecisionKey, { label: string; variant: "emerald" | "amber" | "red" | "slate" }> = {
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

export const DECISION_BORDER_COLOR: Record<string, string> = {
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

export function deltaColor(value: number | null | undefined, invert = false): string {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.5) return "text-slate-900 dark:text-white";
  const positive = invert ? value < 0 : value > 0;
  return positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

// --- Helpers ---

function parseTemplateKey(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split("|").map((p) => p.trim()).filter(Boolean);
}

// --- InfoTip ---

function InfoTip({ text }: { text: string }) {
  return (
    <div className="group/tip relative inline-flex items-center">
      <button
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 text-[9px] font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors leading-none select-none"
        aria-label="Info"
        type="button"
      >
        i
      </button>
      <div className="pointer-events-none absolute bottom-full right-0 mb-1 z-10 w-48 rounded bg-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 group-hover/tip:opacity-100 transition-opacity">
        {text}
      </div>
    </div>
  );
}

// --- Stat renderers ---


function statKpi(
  label: string,
  value: string,
  valueColor: string,
  delta: string,
  deltaColorClass: string,
  tooltip: string,
) {
  return (
    <div className="relative rounded-sm border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="absolute top-2 right-2">
        <InfoTip text={tooltip} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pr-5">{label}</p>
      <p className={`mt-1 text-lg font-semibold break-words leading-tight ${valueColor}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] ${deltaColorClass}`}>{delta}</p>
    </div>
  );
}

function statCompact(label: string, value: string, tooltip?: string) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {tooltip && <InfoTip text={tooltip} />}
      </div>
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
          {/* Template key: chips layout */}
          <div className="mt-1.5 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gabarit de comparaison</p>
            <div className="flex flex-wrap gap-1">
              {parseTemplateKey(formAnalysis.template_key).map((part, i) => (
                <span
                  key={i}
                  className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500"
                >
                  {part}
                </span>
              ))}
              {!formAnalysis.template_key && (
                <span className="text-[10px] text-slate-400">—</span>
              )}
            </div>
            {formAnalysis.comparison_mode && (
              <p className="text-[10px] text-slate-400">
                Mode · <span className="text-slate-500 font-medium">{formAnalysis.comparison_mode}</span>
              </p>
            )}
          </div>
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
          {statKpi(
            "Output",
            fmt(formAnalysis.output?.mean, 1, formAnalysis.output?.unit ? ` ${formAnalysis.output.unit}` : ""),
            "text-slate-900 dark:text-white",
            formAnalysis.output?.delta_pct != null ? `Δ ${fmtPct(formAnalysis.output.delta_pct)}` : "Δ —",
            deltaColor(formAnalysis.output?.delta_pct),
            "Puissance ou allure moyenne sur les intervalles de travail de cette séance.",
          )}
          {statKpi(
            "EA (Efficience Aérobie)",
            fmt(formAnalysis.ea?.today, 3),
            "text-slate-900 dark:text-white",
            formAnalysis.ea?.delta_pct != null ? `Δ ${fmtPct(formAnalysis.ea.delta_pct)}` : "Δ —",
            deltaColor(formAnalysis.ea?.delta_pct),
            "Rapport output/FC. Plus la valeur est haute, plus l'athlète produit d'effort pour un FC donné.",
          )}
          {statKpi(
            decLabel,
            fmtPct(formAnalysis.decoupling?.today),
            "text-slate-900 dark:text-white",
            formAnalysis.decoupling?.delta != null ? `Δ ${fmtPct(formAnalysis.decoupling.delta)}` : "Δ —",
            deltaColor(formAnalysis.decoupling?.delta, true),
            "Découplage cardiaque sur les intervalles : dérive de la FC à output constant (%). Valeur négative = bonne tenue.",
          )}
          {statKpi(
            "Dérive FC fin",
            fmt(formAnalysis.hrend_drift?.today, 1, " bpm"),
            "text-slate-900 dark:text-white",
            formAnalysis.hrend_drift?.delta != null ? `Δ ${fmt(formAnalysis.hrend_drift.delta, 1)} bpm` : "Δ —",
            deltaColor(formAnalysis.hrend_drift?.delta, true),
            "Dérive de la fréquence cardiaque en fin de séance par rapport au début (bpm).",
          )}
        </div>
      </div>

      {/* ── Tier 3: Context & corrections ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Contexte</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {statCompact("Comparables", formAnalysis.comparable_count != null ? String(formAnalysis.comparable_count) : "—", "Nombre de séances similaires utilisées comme référence.")}
          {statCompact("Lieu", formAnalysis.environment?.location ?? "—")}
          {statCompact("Temp", fmt(formAnalysis.temperature?.temp, 1, " °C"))}
          {statCompact("Tref", fmt(formAnalysis.temperature?.tref, 1, " °C"))}
          {statCompact("Beta HR", fmt(formAnalysis.temperature?.beta_hr, 3, " bpm/°C"), "Sensibilité de la FC à la température (bpm/°C).")}
          {statCompact("HR corr", fmt(formAnalysis.temperature?.hr_corr, 1, " bpm"), "Correction appliquée à la FC pour neutraliser l'effet thermique.")}
        </div>

        {formAnalysis.stable_segment && (
          <div className="mt-2 rounded-sm border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/30 dark:text-slate-400">
            Segment stable {formAnalysis.stable_segment.window_label ?? "—"} · {formAnalysis.stable_segment.selected_points ?? 0} points gardes
          </div>
        )}

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
