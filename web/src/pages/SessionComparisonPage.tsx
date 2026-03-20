import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Card, CardContent } from "@/components/ui/Card";
import { SessionComparisonChart } from "@/components/charts/SessionComparisonChart";
import { SessionDeltaTable } from "@/components/tables/SessionDeltaTable";
import { DECISION_META, DECISION_BORDER_COLOR, deltaColor } from "@/components/activity/FormAnalysisPanel";
import { useActivityDetail } from "@/hooks/useActivityDetail";
import { useSessionComparison } from "@/hooks/useSessionComparison";
import { buildFormAnalysisSummary } from "@/services/sessionComparison.service";
import { formatDistance, formatDuration } from "@/services/format.service";
import type { Activity, ComparisonAlert } from "@/types/activity";

function getAlertStyles(alert: ComparisonAlert) {
  if (alert.kind === "progression") {
    return {
      wrapper: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20",
      icon: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (alert.kind === "cout") {
    return {
      wrapper: "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20",
      icon: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    wrapper: "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20",
    icon: "text-red-600 dark:text-red-400",
  };
}

function formatCandidateLabel(activity: {
  session_date: string;
  manual_activity_name?: string | null;
  activity_name: string;
  distance_m: number | null;
  moving_time_sec: number | null;
  duration_sec: number | null;
}) {
  const dateLabel = new Date(activity.session_date).toLocaleDateString("fr-FR");
  const title = activity.manual_activity_name || activity.activity_name || "Séance";
  const distance = activity.distance_m != null ? formatDistance(activity.distance_m) : "--";
  const durationValue = activity.moving_time_sec ?? activity.duration_sec;
  const duration = durationValue != null ? formatDuration(durationValue) : "--";
  return `${dateLabel} · ${distance} · ${duration} · ${title}`;
}

function FormAnalysisSection({ activity }: { activity: Activity }) {
  const fa = activity.form_analysis;
  if (!fa) {
    return (
      <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        Pas d'analyse de forme disponible pour cette séance.
      </div>
    );
  }

  const comparableCount = fa.comparable_count ?? 0;
  if (comparableCount < 5) {
    return (
      <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        Historique insuffisant pour l'analyse de forme ({comparableCount}/5 séances comparables).
      </div>
    );
  }

  const summary = buildFormAnalysisSummary(fa);
  if (!summary) return null;

  const decisionKey = summary.decision as keyof typeof DECISION_META;
  const meta = DECISION_META[decisionKey] ?? DECISION_META.unknown;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Analyse de forme</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {summary.comparableCount} séances comparables
              {summary.comparisonMode ? ` · ${summary.comparisonMode === "beta_regression" ? "régression β" : "même bin temp"}` : ""}
            </p>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        {fa.decision?.reasons?.length ? (
          <div className={`rounded-sm border-l-4 px-4 py-2.5 ${DECISION_BORDER_COLOR[meta.variant] ?? DECISION_BORDER_COLOR.slate}`}>
            <ul className="space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
              {fa.decision.reasons.map((reason, i) => (
                <li key={`${reason}-${i}`}>- {reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summary.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-sm border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{kpi.value}</p>
              <p className={`text-[11px] ${deltaColor(parseFloat(kpi.delta) || null, kpi.invert)}`}>{kpi.delta}</p>
            </div>
          ))}
        </div>

        {(summary.templateKey || summary.tempInfo) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {summary.templateKey && (
              <span>Gabarit: <span className="text-slate-500">{summary.templateKey}</span></span>
            )}
            {summary.tempInfo && (
              <span>{summary.tempInfo}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionComparisonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { activity, isLoading } = useActivityDetail(id);

  const {
    candidates,
    selectedActivity,
    selectedId,
    setSelectedId,
    isLoadingCandidates,
    isLoadingSelected,
    isSupportedSport,
    hasComparableDistance,
    summary,
    chartModel,
  } = useSessionComparison(activity, true);

  const baseHasStreams = Boolean(activity?.activity_streams?.length);
  const referenceHasStreams = Boolean(selectedActivity?.activity_streams?.length);
  const showChartUnavailableNotice = Boolean(selectedActivity) && !chartModel;

  const backPath = location.pathname.replace(/\/compare$/, "");
  const activityTitle = activity?.manual_activity_name || activity?.activity_name || "Séance";

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!activity) {
    return (
      <div className="space-y-8">
        <button onClick={() => navigate(backPath)} className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary">
          <Icon name="arrow_back" className="text-lg" />
          Retour à la fiche
        </button>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Icon name="search_off" className="text-4xl text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Activité introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-primary">
            <Icon name="arrow_back" className="text-lg" />
            Retour à la fiche
          </button>
          <span className="hidden text-slate-300 dark:text-slate-600 sm:inline">|</span>
          <h1 className="hidden text-lg font-semibold text-slate-900 dark:text-white sm:inline">{activityTitle}</h1>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white sm:hidden">{activityTitle}</h1>
      </div>

      {/* Analysis dirty */}
      {activity.analysis_dirty && (
        <FeatureNotice
          title="Recalcul en cours"
          description="Les analyses de cette séance sont en cours de recalcul. La comparaison pourrait ne pas refléter les dernières données."
          status="partial"
        />
      )}

      {/* Sport not supported */}
      {!isSupportedSport ? (
        <FeatureNotice
          title="Sport hors périmètre"
          description="La comparaison est disponible pour CAP, VELO et NAT uniquement."
          status="partial"
        />
      ) : !hasComparableDistance ? (
        <FeatureNotice
          title="Distance indisponible"
          description="La séance courante n'a pas de distance exploitable. Le filtre ±20% ne peut pas être calculé."
          status="partial"
        />
      ) : (
        <>
          {/* Reference selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="comparison-reference" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Séance de référence
              </label>
              {candidates.length > 0 && <Badge variant="slate">{candidates.length} propositions</Badge>}
            </div>
            {isLoadingCandidates ? (
              <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                Recherche des séances comparables...
              </div>
            ) : candidates.length > 0 ? (
              <select
                id="comparison-reference"
                className="w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatCandidateLabel(candidate)}
                  </option>
                ))}
              </select>
            ) : (
              <FeatureNotice
                title="Aucune séance comparable"
                description="Aucune séance antérieure du même athlète, du même sport et dans la fenêtre de distance ±20% n'a été trouvée."
                status="partial"
              />
            )}
          </div>

          {/* Loading reference */}
          {selectedId && isLoadingSelected && (
            <div className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              Chargement de la séance de référence...
            </div>
          )}

          {/* Alert */}
          {summary && summary.alert.kind !== "none" && (
            <div className={`rounded-sm border px-4 py-3 ${getAlertStyles(summary.alert).wrapper}`}>
              <div className="flex items-start gap-3">
                <Icon name="insights" className={`mt-0.5 ${getAlertStyles(summary.alert).icon}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{summary.alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary.alert.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chart — full width */}
          {summary && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Courbes superposées</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {summary.metricLabel} et FC sur un axe 0–100% de distance normalisée.
                    </p>
                  </div>
                  <Badge variant="primary">{summary.metricUnitLabel}</Badge>
                </div>

                {chartModel ? (
                  <SessionComparisonChart
                    chartModel={chartModel}
                    height="h-[360px] lg:h-[480px]"
                    currentLabel={activity.session_date ? new Date(activity.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "") : "Courante"}
                    referenceLabel={selectedActivity?.session_date ? new Date(selectedActivity.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "") : "Référence"}
                  />
                ) : showChartUnavailableNotice ? (
                  <FeatureNotice
                    title="Courbe indisponible"
                    description={
                      !baseHasStreams || !referenceHasStreams
                        ? "Une des deux séances n'a pas de FIT/streams exploitables pour tracer la comparaison."
                        : "Une des deux séances n'a pas encore de distance cumulée exploitable dans ses streams."
                    }
                    status="backend"
                  />
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Bottom grid: Deltas + Form Analysis */}
          {summary && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Deltas de séance</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Volume, durée, métrique principale, FC moyenne et découplage.
                    </p>
                  </div>
                  <SessionDeltaTable summary={summary} />
                </CardContent>
              </Card>

              <FormAnalysisSection activity={activity} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
