import { Icon } from "@/components/ui/Icon";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Card, CardContent } from "@/components/ui/Card";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { SessionComparisonChart } from "@/components/charts/SessionComparisonChart";
import { SessionDeltaTable } from "@/components/tables/SessionDeltaTable";
import { useSessionComparison } from "@/hooks/useSessionComparison";
import { formatDistance, formatDuration } from "@/services/format.service";
import type { Activity, ComparisonAlert } from "@/types/activity";

interface Props {
  open: boolean;
  onClose: () => void;
  activity: Activity;
}

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

export function SessionComparisonDialog({ open, onClose, activity }: Props) {
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
  } = useSessionComparison(activity, open);

  const baseHasStreams = Boolean(activity.activity_streams?.length);
  const referenceHasStreams = Boolean(selectedActivity?.activity_streams?.length);
  const showChartUnavailableNotice = Boolean(selectedActivity) && !chartModel;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Comparer une séance similaire</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comparaison intra-athlète sur distance normalisée.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
          <Icon name="close" />
        </Button>
      </DialogHeader>

      <DialogBody className="space-y-5">
        {!isSupportedSport ? (
          <FeatureNotice
            title="Sport hors périmètre"
            description="La comparaison US27b est disponible pour CAP, VELO et NAT uniquement."
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="comparison-reference" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Séance de référence
                </label>
                {candidates.length > 0 && <Badge variant="slate">{candidates.length} propositions</Badge>}
              </div>
              {isLoadingCandidates ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Recherche des séances comparables...
                </div>
              ) : candidates.length > 0 ? (
                <SearchableSelect
                  value={selectedId}
                  onChange={setSelectedId}
                  options={candidates.map((candidate) => ({
                    value: candidate.id,
                    label: formatCandidateLabel(candidate),
                  }))}
                  placeholder="Sélectionner une séance"
                  className="w-full"
                />
              ) : (
                <FeatureNotice
                  title="Aucune séance comparable"
                  description="Aucune séance antérieure du même athlète, du même sport et dans la fenêtre de distance ±20% n'a été trouvée."
                  status="partial"
                />
              )}
            </div>

            {selectedId && isLoadingSelected && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                Chargement de la séance de référence...
              </div>
            )}

            {summary && summary.alert.kind !== "none" && (
              <div className={`rounded-xl border px-4 py-3 ${getAlertStyles(summary.alert).wrapper}`}>
                <div className="flex items-start gap-3">
                  <Icon name="insights" className={`mt-0.5 ${getAlertStyles(summary.alert).icon}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{summary.alert.title}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summary.alert.message}</p>
                  </div>
                </div>
              </div>
            )}

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
                    <SessionComparisonChart chartModel={chartModel} />
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

            {summary && (
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
            )}
          </>
        )}
      </DialogBody>

      <DialogFooter className="justify-end">
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
