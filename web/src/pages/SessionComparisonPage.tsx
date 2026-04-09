import { Link, useLocation, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Disclosure, DisclosureContent, DisclosureTrigger } from "@/components/ui/Disclosure";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Icon } from "@/components/ui/Icon";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Input } from "@/components/ui/Input";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { SessionComparisonChart } from "@/components/charts/SessionComparisonChart";
import { SessionDeltaTable } from "@/components/tables/SessionDeltaTable";
import { useActivityDetail } from "@/hooks/useActivityDetail";
import { useSessionComparison, type SessionComparisonSelectionMode } from "@/hooks/useSessionComparison";
import { cn } from "@/lib/cn";
import { extractActivityNavigationState } from "@/lib/activityNavigation";
import { DURATION_OPTIONS, WORK_TYPE_OPTIONS } from "@/services/filter.service";
import { formatDistance, formatDuration } from "@/services/format.service";
import type {
  ActivityComparisonCandidate,
  ComparisonAlert,
  ComparisonRangeSelection,
} from "@/types/activity";

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

function formatMonthGroup(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(date));
}

function formatRangeBadgeLabel(range: ComparisonRangeSelection, maxDistanceKm: number) {
  if (maxDistanceKm <= 0) return "Séance complète";

  const isFull = range.startKm <= 0.01 && range.endKm >= maxDistanceKm - 0.01;
  if (isFull) {
    return `0 → ${maxDistanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
  }

  return `${range.startKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} → ${range.endKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

function groupCandidatesByMonth(candidates: ActivityComparisonCandidate[]) {
  const groups = new Map<string, { label: string; items: ActivityComparisonCandidate[] }>();

  for (const candidate of candidates) {
    const key = new Date(candidate.session_date).toISOString().slice(0, 7);
    const label = formatMonthGroup(candidate.session_date);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(candidate);
    } else {
      groups.set(key, { label, items: [candidate] });
    }
  }

  return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
}

function WorkTypeBadge({ workType }: { workType?: string | null }) {
  if (!workType) return null;

  return (
    <Badge
      variant={
        workType === "competition" ? "orange" : workType === "endurance" ? "primary" : "slate"
      }
    >
      {workType === "competition" ? "Compétition" : workType === "intervals" ? "Fractionné" : "Endurance"}
    </Badge>
  );
}

function RangeEditorCard({
  label,
  accentClassName,
  range,
  maxDistanceKm,
  onChange,
  canEdit,
  sessionLabel,
}: {
  label: string;
  accentClassName: string;
  range: ComparisonRangeSelection;
  maxDistanceKm: number;
  onChange: (range: ComparisonRangeSelection) => void;
  canEdit: boolean;
  sessionLabel: string;
}) {
  const safeMax = Math.max(0, maxDistanceKm);
  const startPct = safeMax > 0 ? (range.startKm / safeMax) * 100 : 0;
  const endPct = safeMax > 0 ? (range.endKm / safeMax) * 100 : 100;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sessionLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="slate">{formatRangeBadgeLabel(range, safeMax)}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ startKm: 0, endKm: safeMax })}
            disabled={!canEdit}
          >
            Pleine séance
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="absolute inset-y-0 rounded-full bg-slate-200 dark:bg-slate-700"
            style={{ left: 0, width: `${Math.max(0, startPct)}%` }}
          />
          <div
            className={cn("absolute inset-y-0 rounded-full", accentClassName)}
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>0 km</span>
          <span>{safeMax.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Début (km)</span>
          <Input
            type="number"
            min={0}
            max={safeMax}
            step={0.1}
            value={Number.isFinite(range.startKm) ? range.startKm : 0}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (!Number.isFinite(nextValue)) return;
              onChange({ ...range, startKm: nextValue });
            }}
            disabled={!canEdit}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fin (km)</span>
          <Input
            type="number"
            min={0}
            max={safeMax}
            step={0.1}
            value={Number.isFinite(range.endKm) ? range.endKm : safeMax}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (!Number.isFinite(nextValue)) return;
              onChange({ ...range, endKm: nextValue });
            }}
            disabled={!canEdit}
          />
        </label>
      </div>

      {!canEdit && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <Icon name="insights" className="mt-0.5 text-sm" />
          La sélection fine des kilomètres nécessite des streams exploitables sur cette séance.
        </div>
      )}
    </div>
  );
}

export function SessionComparisonPage() {
  const { id } = useParams();
  const location = useLocation();

  const { activity, isLoading } = useActivityDetail(id);

  const {
    selectedActivity,
    selectedId,
    setSelectedId,
    selectionMode,
    setSelectionMode,
    recommendedCandidates,
    libraryCandidates,
    isLoadingCandidates,
    isLoadingLibrary,
    isLoadingSelected,
    isSupportedSport,
    hasComparableDistance,
    summary,
    chartModel,
    librarySearch,
    setLibrarySearch,
    libraryWorkType,
    setLibraryWorkType,
    libraryDurationRange,
    setLibraryDurationRange,
    libraryDateFrom,
    setLibraryDateFrom,
    libraryDateTo,
    setLibraryDateTo,
    hasActiveLibraryFilters,
    resetLibraryFilters,
    baseRange,
    referenceRange,
    setBaseRange,
    setReferenceRange,
    baseMaxDistanceKm,
    referenceMaxDistanceKm,
    canEditBaseRange,
    canEditReferenceRange,
  } = useSessionComparison(activity, true);

  const baseHasStreams = Boolean(activity?.activity_streams?.length);
  const referenceHasStreams = Boolean(selectedActivity?.activity_streams?.length);
  const showChartUnavailableNotice = Boolean(selectedActivity) && !chartModel;

  const backPath = location.pathname.replace(/\/compare$/, "");
  const navigationState = extractActivityNavigationState(location.state);
  const activityTitle = activity?.manual_activity_name || activity?.activity_name || "Séance";
  const selectionTabs = [
    {
      key: "recommended" as SessionComparisonSelectionMode,
      label: "Séances similaires",
      shortLabel: "Similaires",
      icon: <Icon name="auto_awesome" className="text-[16px]" />,
    },
    {
      key: "library" as SessionComparisonSelectionMode,
      label: "Choix libre",
      shortLabel: "Libre",
      icon: <Icon name="folder_open" className="text-[16px]" />,
    },
  ];
  const libraryGroups = groupCandidatesByMonth(libraryCandidates);
  const activeLoading = selectionMode === "library" ? isLoadingLibrary : isLoadingCandidates;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-8">
        <Link to={backPath} state={navigationState} className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-all duration-150 hover:text-primary">
          <Icon name="arrow_back" className="text-lg" />
          Retour à la fiche
        </Link>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Icon name="search_off" className="text-4xl text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Activité introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to={backPath} state={navigationState} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-all duration-150 hover:text-primary">
            <Icon name="arrow_back" className="text-lg" />
            Retour à la fiche
          </Link>
          <span className="hidden text-slate-300 dark:text-slate-600 sm:inline">|</span>
          <h1 className="hidden text-lg font-semibold text-slate-900 dark:text-white sm:inline">{activityTitle}</h1>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white sm:hidden">{activityTitle}</h1>
      </div>

      {activity.analysis_dirty && (
        <FeatureNotice
          title="Recalcul en cours"
          description="Les analyses de cette séance sont en cours de recalcul. La comparaison pourrait ne pas refléter les dernières données."
          status="partial"
        />
      )}

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
          <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Séance de référence</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Basculez entre les suggestions similaires et une bibliothèque libre sur toutes les séances du même sport.
                  </p>
                </div>
                <SlidingTabs items={selectionTabs} value={selectionMode} onChange={setSelectionMode} size="sm" />
              </div>

              {selectionMode === "recommended" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Suggestions proches</p>
                    {recommendedCandidates.length > 0 && <Badge variant="slate">{recommendedCandidates.length} propositions</Badge>}
                  </div>
                  {isLoadingCandidates ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      Recherche des séances comparables...
                    </div>
                  ) : recommendedCandidates.length > 0 ? (
                    <SearchableSelect
                      value={selectedId}
                      onChange={setSelectedId}
                      options={recommendedCandidates.map((candidate) => ({
                        value: candidate.id,
                        label: formatCandidateLabel(candidate),
                      }))}
                      placeholder="Sélectionner une séance"
                      className="w-full"
                    />
                  ) : (
                    <FeatureNotice
                      title="Aucune séance comparable"
                      description="Aucune séance antérieure du même athlète, du même sport et dans la fenêtre de distance ±20% n'a été trouvée. Le mode choix libre reste disponible."
                      status="partial"
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_auto]">
                    <Input
                      icon="search"
                      placeholder="Rechercher une séance..."
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      {hasActiveLibraryFilters && (
                        <Button type="button" variant="ghost" size="sm" onClick={resetLibraryFilters}>
                          Réinitialiser
                        </Button>
                      )}
                      <Badge variant="slate">{libraryCandidates.length} séances</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLibraryWorkType("")}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        !libraryWorkType
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      )}
                    >
                      Tous les types
                    </button>
                    {WORK_TYPE_OPTIONS.map((option) => {
                      const isActive = libraryWorkType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLibraryWorkType(isActive ? "" : option.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLibraryDurationRange("")}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        !libraryDurationRange
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      )}
                    >
                      Toutes durées
                    </button>
                    {DURATION_OPTIONS.map((option) => {
                      const isActive = libraryDurationRange === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLibraryDurationRange(isActive ? "" : option.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Du</span>
                      <Input type="date" value={libraryDateFrom} onChange={(event) => setLibraryDateFrom(event.target.value)} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Au</span>
                      <Input type="date" value={libraryDateTo} onChange={(event) => setLibraryDateTo(event.target.value)} />
                    </label>
                  </div>

                  {activeLoading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      Chargement des séances du même sport...
                    </div>
                  ) : libraryGroups.length > 0 ? (
                    <div className="space-y-3">
                      {libraryGroups.map((group) => {
                        const containsSelection = group.items.some((item) => item.id === selectedId);

                        return (
                          <Disclosure key={`${group.key}-${containsSelection ? "selected" : "closed"}`} defaultOpen={containsSelection}>
                            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                              <DisclosureTrigger className="flex w-full items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Icon name="calendar_month" className="text-slate-400" />
                                  <div>
                                    <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{group.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{group.items.length} séance{group.items.length > 1 ? "s" : ""}</p>
                                  </div>
                                </div>
                                <Icon name="expand_more" className="text-slate-400" />
                              </DisclosureTrigger>
                              <DisclosureContent className="px-3 pb-3">
                                <div className="space-y-2">
                                  {group.items.map((candidate) => {
                                    const isSelected = candidate.id === selectedId;
                                    const isRecommended = recommendedCandidates.some((item) => item.id === candidate.id);
                                    const title = candidate.manual_activity_name || candidate.activity_name || "Séance";
                                    const dateLabel = new Date(candidate.session_date).toLocaleDateString("fr-FR", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    });
                                    const distance = candidate.distance_m != null ? formatDistance(candidate.distance_m) : "--";
                                    const duration = candidate.moving_time_sec ?? candidate.duration_sec;

                                    return (
                                      <button
                                        key={candidate.id}
                                        type="button"
                                        onClick={() => setSelectedId(candidate.id)}
                                        className={cn(
                                          "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                                          isSelected
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                                        )}
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {isRecommended && <Badge variant="primary">Recommandée</Badge>}
                                            <WorkTypeBadge workType={candidate.work_type} />
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{distance}</span>
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{duration != null ? formatDuration(duration) : "--"}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </DisclosureContent>
                            </div>
                          </Disclosure>
                        );
                      })}
                    </div>
                  ) : (
                    <FeatureNotice
                      title="Aucune séance trouvée"
                      description="Aucune séance du même sport ne correspond à ces filtres."
                      status="partial"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedId && isLoadingSelected && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              Chargement de la séance de référence...
            </div>
          )}

          {selectedActivity && (
            <Card>
              <CardContent className="space-y-5 p-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Périodes comparées</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Choisissez précisément les fenêtres à superposer. Chaque plage est renormalisée sur 0–100% pour comparer des blocs équivalents.
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <RangeEditorCard
                    label="Séance 1"
                    accentClassName="bg-blue-500/80"
                    range={baseRange}
                    maxDistanceKm={baseMaxDistanceKm}
                    onChange={setBaseRange}
                    canEdit={canEditBaseRange}
                    sessionLabel={activityTitle}
                  />
                  <RangeEditorCard
                    label="Séance 2"
                    accentClassName="bg-orange-500/80"
                    range={referenceRange}
                    maxDistanceKm={referenceMaxDistanceKm}
                    onChange={setReferenceRange}
                    canEdit={canEditReferenceRange}
                    sessionLabel={selectedActivity.manual_activity_name || selectedActivity.activity_name || "Séance de référence"}
                  />
                </div>
              </CardContent>
            </Card>
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
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Courbes superposées</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {summary.metricLabel} et FC sur un axe 0–100% de distance normalisée.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary">{summary.metricUnitLabel}</Badge>
                    <Badge variant="slate">{summary.currentRangeLabel}</Badge>
                    <Badge variant="orange">{summary.referenceRangeLabel}</Badge>
                  </div>
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

          {summary && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {summary.isSegmentComparison ? "Deltas de segment" : "Deltas de séance"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Volume, durée, métrique principale, FC moyenne, découplage, température et D+.
                  </p>
                </div>
                <SessionDeltaTable summary={summary} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
