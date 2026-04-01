import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mapWorkTypeLabel, getIndoorTag } from "@/services/activity.service";
import type { Activity, WorkTypeValue } from "@/types/activity";

interface Props {
  activity: Activity;
  onBack: () => void;
  onOpenComparison: () => void;
  onReprocess: () => Promise<{ success: boolean; error?: string } | undefined>;
  onSaveWorkType: (manualWorkType: WorkTypeValue | null) => Promise<{ success: boolean; error?: string; reprocessDispatched: boolean; warning?: string | null }>;
  isReprocessing: boolean;
  reprocessLaunched: boolean;
  onReprocessLaunched: () => void;
  isSavingWorkType: boolean;
  workTypeSaveError: string | null;
  workTypeWarning: string | null;
  isCoach: boolean;
}

const WORK_TYPE_OPTIONS: Array<{ value: "" | WorkTypeValue; label: string }> = [
  { value: "", label: "Auto (détection)" },
  { value: "endurance", label: "Endurance" },
  { value: "intervals", label: "Fractionné" },
  { value: "competition", label: "Compétition" },
];

export function ActivityHeader({
  activity,
  onBack,
  onOpenComparison,
  onReprocess,
  onSaveWorkType,
  isReprocessing,
  reprocessLaunched,
  onReprocessLaunched,
  isSavingWorkType,
  workTypeSaveError,
  workTypeWarning,
  isCoach,
}: Props) {
  const athleteName = activity.athletes
    ? `${activity.athletes.first_name} ${activity.athletes.last_name.charAt(0)}.`
    : "Inconnu";
  const title = activity.manual_activity_name || activity.activity_name || "Activité";
  const sessionDate = activity.session_date
    ? new Date(activity.session_date).toLocaleDateString("fr-FR")
    : "--";
  const hasFitFile = Boolean(activity.fit_file_path);
  const hasResolvedBlocks = Boolean(activity.segmented_metrics?.interval_blocks?.length);
  const indoorTag = getIndoorTag(activity.sport_type, activity.source_json?.sport, activity.activity_name);

  const hasManualOverride = Boolean(activity.manual_work_type);
  const hasPendingAnalysis = Boolean(activity.analysis_dirty);

  // Inline work type popover
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popoverOpen]);

  const currentManualWorkType = (activity.manual_work_type ?? "") as "" | WorkTypeValue;

  async function handleSelectWorkType(value: "" | WorkTypeValue) {
    if (value === currentManualWorkType) {
      setPopoverOpen(false);
      return;
    }
    setPopoverOpen(false);
    await onSaveWorkType(value || null);
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 transition-all duration-150 hover:text-primary"
        data-testid="activity-back-button"
      >
        <Icon name="arrow_back" className="text-lg" />
        Retour aux activités
      </button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
            {hasFitFile && <Badge variant="emerald">FIT stocké</Badge>}
            {hasResolvedBlocks && <Badge variant="primary">Blocs détectés</Badge>}
            {indoorTag && <Badge variant="slate">{indoorTag === "(HT)" ? "Home Trainer" : "Tapis"}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Icon name="person" className="text-slate-400" />
              {athleteName}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
              <Icon name="calendar_today" className="text-slate-400" />
              {sessionDate}
            </span>

            {/* Work type badge — inline editable for coach */}
            <div className="relative" ref={popoverRef}>
              {isCoach ? (
                <button
                  type="button"
                  onClick={() => !isSavingWorkType && setPopoverOpen((v) => !v)}
                  disabled={isSavingWorkType}
                  className="group flex items-center gap-1 rounded-lg transition-all"
                  title="Modifier le type de séance"
                >
                  <Badge variant={hasManualOverride ? "orange" : "primary"}>
                    {isSavingWorkType ? (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                        Enregistrement…
                      </span>
                    ) : (
                      mapWorkTypeLabel(activity.work_type)
                    )}
                  </Badge>
                  <Icon
                    name="edit"
                    className="text-[14px] text-slate-400 transition-all duration-150 group-hover:text-primary dark:text-slate-500 dark:group-hover:text-primary"
                  />
                </button>
              ) : (
                <Badge variant={hasManualOverride ? "orange" : "primary"}>
                  {mapWorkTypeLabel(activity.work_type)}
                </Badge>
              )}

              {popoverOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {WORK_TYPE_OPTIONS.map((option) => {
                    const isActive = option.value === currentManualWorkType;
                    return (
                      <button
                        key={option.value || "auto"}
                        type="button"
                        onClick={() => handleSelectWorkType(option.value)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-700/60 ${
                          isActive
                            ? "font-semibold text-primary"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isActive && <Icon name="check" className="text-[16px] text-primary" />}
                        <span className={isActive ? "" : "pl-6"}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {hasManualOverride && activity.detected_work_type && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500" title="Type détecté automatiquement">
                auto : {mapWorkTypeLabel(activity.detected_work_type)}
              </span>
            )}
            {hasPendingAnalysis && <Badge variant="amber">Recalcul en cours</Badge>}

            {workTypeSaveError && (
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{workTypeSaveError}</span>
            )}
            {workTypeWarning && !workTypeSaveError && (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">{workTypeWarning}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 lg:items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="secondary" size="sm" onClick={onOpenComparison} disabled={hasPendingAnalysis}>
              <Icon name="compare_arrows" />
              Comparer une séance similaire
            </Button>
            {isCoach && hasFitFile && (
              <Button
                variant="outline"
                size="sm"
                disabled={isReprocessing}
                onClick={async () => {
                  const result = await onReprocess();
                  if (result?.success) {
                    onReprocessLaunched();
                  }
                }}
              >
                {isReprocessing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Icon name="refresh" />
                )}
                {isReprocessing ? "Recalcul..." : "Recalculer"}
              </Button>
            )}
          </div>
          {reprocessLaunched && isCoach && hasFitFile && (
            <p className="text-[11px] text-slate-400">
              Rafraîchir dans ~3 min pour voir les nouvelles métriques
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
