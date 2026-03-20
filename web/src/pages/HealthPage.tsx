import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { useReadiness } from "@/hooks/useReadiness";
import { useAthletes } from "@/hooks/useAthletes";
import { useAthleteKpis } from "@/hooks/useAthleteKpis";
import { useExportBilan } from "@/hooks/useExportBilan";
import { useAcwr } from "@/hooks/useAcwr";
import { getReadinessSeries, insertHrvBatch } from "@/repositories/readiness.repository";
import type { DailyReadiness } from "@/types/readiness";
import {
  buildHrvTimeline,
  parseHrvCsv,
  type HrvSwcStatus,
  type ParsedHrvImportRow,
} from "@/services/hrv.service";

type ImportStatus = "idle" | "importing" | "success" | "error";
type HealthSortBy =
  | "athlete"
  | "date"
  | "rmssd"
  | "resting_hr"
  | "swc"
  | "weight";

interface StagedImport {
  fileName: string;
  rows: ParsedHrvImportRow[];
  rowCount: number;
  dateMin: string;
  dateMax: string;
}

const DEFAULT_SORT_BY: HealthSortBy = "date";
const DEFAULT_SORT_DIR: SortDirection = "desc";
const SWC_SORT_ORDER: Record<Exclude<HrvSwcStatus, "insufficient_data">, number> = {
  above_swc: 0,
  below_swc: 1,
  within_swc: 2,
};

function getSwcSortValue(status: HrvSwcStatus | null): number {
  if (!status || status === "insufficient_data") return 99;
  return SWC_SORT_ORDER[status];
}

function getSwcBadge(status: HrvSwcStatus | null) {
  switch (status) {
    case "above_swc":
      return {
        label: "Hors SWC",
        detail: "Au-dessus",
        className:
          "bg-amber-100/70 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
        icon: "warning_amber",
      };
    case "below_swc":
      return {
        label: "Hors SWC",
        detail: "En-dessous",
        className:
          "bg-rose-100/70 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
        icon: "trending_down",
      };
    case "within_swc":
      return {
        label: "Dans SWC",
        detail: "Normal",
        className:
          "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
        icon: "check_circle",
      };
    default:
      return {
        label: "SWC",
        detail: "Données insuffisantes",
        className:
          "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
        icon: "horizontal_rule",
      };
  }
}

function formatScore(value: number | null) {
  return value !== null ? value.toFixed(1) : "--";
}

function formatDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

export function HealthPage() {
  const [selectedAthleteId, setSelectedAthleteId] = useState("all");
  const [importAthleteId, setImportAthleteId] = useState("");
  const [sortBy, setSortBy] = useState<HealthSortBy>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const [stagedImport, setStagedImport] = useState<StagedImport | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");

  const { healthData, isLoading, refresh } = useReadiness();
  const { athletes } = useAthletes();
  const hasSelectedAthlete = selectedAthleteId !== "all";
  const { report: kpiReport } = useAthleteKpis(hasSelectedAthlete ? selectedAthleteId : null, "week");
  const { detail: acwrDetail } = useAcwr({ athleteId: hasSelectedAthlete ? selectedAthleteId : null, enabled: hasSelectedAthlete });
  const { exportPdf, isExporting } = useExportBilan();

  const [readinessSeries, setReadinessSeries] = useState<DailyReadiness[]>([]);
  const [isKpiLoading, setIsKpiLoading] = useState(false);
  const [kpiRefreshToken, setKpiRefreshToken] = useState(0);

  useEffect(() => {
    if (selectedAthleteId === "all") {
      setReadinessSeries([]);
      return;
    }
    setIsKpiLoading(true);
    getReadinessSeries(selectedAthleteId, 30)
      .then(setReadinessSeries)
      .catch(console.error)
      .finally(() => setIsKpiLoading(false));
  }, [selectedAthleteId, kpiRefreshToken]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAthlete =
    selectedAthleteId === "all"
      ? null
      : athletes.find((athlete) => athlete.id === selectedAthleteId) ?? null;

  const importAthlete =
    importAthleteId
      ? athletes.find((athlete) => athlete.id === importAthleteId) ?? null
      : null;

  const filteredData =
    selectedAthleteId === "all"
      ? healthData
      : healthData.filter((row) => row.athlete_id === selectedAthleteId);

  const sortedData = sortRows(
    filteredData,
    (row) => {
      switch (sortBy) {
        case "athlete":
          return row.athlete;
        case "rmssd":
          return row.rmssd_matinal;
        case "resting_hr":
          return row.fc_repos;
        case "swc":
          return getSwcSortValue(row.swc_status);
        case "weight":
          return row.poids;
        case "date":
        default:
          return new Date(row.date);
      }
    },
    sortDir
  );

  const selectedTimeline = buildHrvTimeline(readinessSeries);
  const latestSelectedPoint =
    selectedTimeline.length > 0
      ? selectedTimeline[selectedTimeline.length - 1]
      : null;

  const alertCount = healthData.filter(
    (row) => row.swc_status === "above_swc" || row.swc_status === "below_swc"
  ).length;
  const signalReadyCount = healthData.filter(
    (row) => row.swc_status !== null && row.swc_status !== "insufficient_data"
  ).length;
  const okCount = healthData.filter(
    (row) => row.swc_status === "within_swc"
  ).length;
  const readinessPct =
    signalReadyCount > 0 ? Math.round((okCount / signalReadyCount) * 100) : 0;

  const lastSyncRow = healthData.length
    ? healthData.reduce((latest, row) => (row.date > latest.date ? row : latest))
    : null;

  const lastSyncLabel = lastSyncRow ? formatDateLabel(lastSyncRow.date) : "--";

  const clearStagedImport = () => {
    setStagedImport(null);
    setImportModalOpen(false);
    setImportAthleteId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stageFile = async (file: File) => {
    setImportStatus("idle");
    setImportMessage("");

    try {
      const text = await file.text();
      const rows = parseHrvCsv(text);
      if (rows.length === 0) {
        setStagedImport(null);
        setImportStatus("error");
        setImportMessage("Aucune ligne exploitable trouvée dans le CSV Android.");
        return;
      }

      const dates = rows.map((row) => row.date).sort();
      setStagedImport({
        fileName: file.name,
        rows,
        rowCount: rows.length,
        dateMin: dates[0] ?? "",
        dateMax: dates[dates.length - 1] ?? "",
      });
      setImportModalOpen(true);
      setImportStatus("idle");
      setImportMessage("");
    } catch (error) {
      setStagedImport(null);
      setImportStatus("error");
      setImportMessage(
        error instanceof Error ? error.message : "Erreur lors de la lecture du fichier."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await stageFile(file);
  };

  const handleConfirmImport = async () => {
    if (!stagedImport || !importAthleteId) {
      setImportStatus("error");
      setImportMessage("Charge un fichier puis sélectionne un athlète avant confirmation.");
      return;
    }

    setImportStatus("importing");
    setImportMessage("");

    try {
      const deduplicatedRows = new Map<
        string,
        {
          athlete_id: string;
          date: string;
          rmssd: number | null;
          resting_hr: number | null;
          sleep_duration: number | null;
          sleep_score: number | null;
          sleep_quality: number | null;
          mental_energy: number | null;
          fatigue: number | null;
          lifestyle: number | null;
          muscle_soreness: number | null;
          physical_condition: number | null;
          training_performance: number | null;
          training_rpe: number | null;
          recovery_points: number | null;
          sickness: string | null;
          alcohol: string | null;
        }
      >();

      for (const row of stagedImport.rows) {
        deduplicatedRows.set(row.date, {
          athlete_id: importAthleteId,
          date: row.date,
          rmssd: row.rmssd,
          resting_hr: row.resting_hr,
          sleep_duration: row.sleep_duration,
          sleep_score: row.sleep_score,
          sleep_quality: row.sleep_quality,
          mental_energy: row.mental_energy,
          fatigue: row.fatigue,
          lifestyle: row.lifestyle,
          muscle_soreness: row.muscle_soreness,
          physical_condition: row.physical_condition,
          training_performance: row.training_performance,
          training_rpe: row.training_rpe,
          recovery_points: row.recovery_points,
          sickness: row.sickness,
          alcohol: row.alcohol,
        });
      }

      const batch = [...deduplicatedRows.values()];
      await insertHrvBatch(batch);
      await refresh();
      setKpiRefreshToken((n) => n + 1);
      setImportStatus("success");
      setImportMessage(
        `${batch.length} mesure${batch.length > 1 ? "s" : ""} importée${batch.length > 1 ? "s" : ""} pour ${importAthlete?.first_name ?? "l'athlète sélectionné"}.`
      );
      clearStagedImport();
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error ? error.message : "Erreur lors de l'import."
      );
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleSort = (column: HealthSortBy) => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir(column === "date" ? "desc" : "asc");
      return;
    }

    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }

    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon
          name="progress_activity"
          className="animate-spin text-primary text-3xl"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <Icon name="analytics" className="text-slate-400" />
          Suivi Biometrique & Readiness
        </h2>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Icon name="notifications" className="text-2xl" />
            {alertCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent-orange rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>
          <Button
            disabled={!hasSelectedAthlete || !kpiReport || isExporting}
            title={hasSelectedAthlete ? "Exporter le bilan PDF de l'athlète sélectionné" : "Sélectionnez un athlète pour exporter"}
            onClick={() => {
              if (!kpiReport || !selectedAthlete) return;
              const name = `${selectedAthlete.first_name} ${selectedAthlete.last_name}`;
              const acwrMetrics = acwrDetail
                ? [acwrDetail.external, acwrDetail.internal, acwrDetail.global]
                : undefined;
              exportPdf(kpiReport, name, acwrMetrics);
            }}
          >
            <Icon
              name={isExporting ? "progress_activity" : "download"}
              className={isExporting ? "animate-spin" : ""}
            />
            {isExporting ? "Export..." : "Exporter PDF"}
          </Button>
        </div>
      </div>

      <FeatureNotice
        title="Import Android + signal SWC"
        description="Le fichier HRV4Training peut être déposé avant de choisir l'athlète. L'import réel part uniquement à la confirmation."
        status="partial"
      />

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Icon name="upload_file" className="text-primary text-xl" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Import de donnees HRV4Training Android
            </h3>
            <Badge variant="slate">1 athlete / fichier</Badge>
            {stagedImport && <Badge variant="primary">Fichier chargé</Badge>}
            {importStatus === "success" && (
              <Badge variant="emerald">{importMessage}</Badge>
            )}
            {importStatus === "error" && (
              <Badge variant="red">{importMessage}</Badge>
            )}
            {importStatus === "importing" && (
              <Icon
                name="progress_activity"
                className="animate-spin text-primary text-sm"
              />
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <div
            className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors rounded-sm p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/50"
            onClick={handleImportClick}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const file = event.dataTransfer.files[0];
              if (file) {
                void stageFile(file);
              }
            }}
          >
            <div className="bg-accent-blue/10 rounded-sm p-4 mb-4">
              <Icon name="cloud_upload" className="text-accent-blue text-3xl" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Glissez-deposez l'export Android HRV4Training ici
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Le fichier est d'abord analysé, puis rattaché à un athlète avant l'import.
            </p>
            <div className="font-mono bg-slate-100 dark:bg-slate-800 rounded p-2 text-xs text-slate-600 dark:text-slate-400">
              Colonnes prises en compte: date, HR, rMSSD, sleep_time, sleep_quality, mental_energy, fatigue, lifestyle, muscle_soreness, physical_condition, training_performance, trainingRPE, HRV4T_Recovery_Points, sickness, alcohol
            </div>
          </div>

          <Dialog open={importModalOpen} onClose={clearStagedImport}>
            {stagedImport && (
              <>
                <DialogHeader>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Import HRV4Training
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Vérifiez les données puis sélectionnez l'athlète.
                    </p>
                  </div>
                  <button
                    onClick={clearStagedImport}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <Icon name="close" className="text-xl" />
                  </button>
                </DialogHeader>
                <DialogBody className="space-y-5">
                  <div className="rounded-sm border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Fichier prêt
                        </p>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {stagedImport.fileName}
                        </h4>
                      </div>
                      <Badge variant="slate">
                        {stagedImport.rowCount} ligne{stagedImport.rowCount > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Début
                        </p>
                        <p className="text-slate-900 dark:text-white">
                          {formatDateLabel(stagedImport.dateMin)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Fin
                        </p>
                        <p className="text-slate-900 dark:text-white">
                          {formatDateLabel(stagedImport.dateMax)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          rMSSD
                        </p>
                        <p className="text-slate-900 dark:text-white">Oui</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Subjectifs
                        </p>
                        <p className="text-slate-900 dark:text-white">Oui</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                      Athlète de l'import
                    </label>
                    <select
                      value={importAthleteId}
                      onChange={(event) => setImportAthleteId(event.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Choisir un athlète</option>
                      {athletes.map((athlete) => (
                        <option key={athlete.id} value={athlete.id}>
                          {athlete.first_name} {athlete.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {importStatus === "error" && importMessage && (
                    <p className="text-sm text-red-600 dark:text-red-400">{importMessage}</p>
                  )}
                </DialogBody>
                <DialogFooter>
                  <Button
                    onClick={() => void handleConfirmImport()}
                    disabled={!importAthleteId || importStatus === "importing"}
                  >
                    {importStatus === "importing" ? (
                      <Icon name="progress_activity" className="animate-spin text-sm" />
                    ) : (
                      <Icon name="check" />
                    )}
                    Confirmer l'import
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleImportClick}
                    disabled={importStatus === "importing"}
                  >
                    Remplacer le fichier
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={clearStagedImport}
                    disabled={importStatus === "importing"}
                  >
                    Annuler
                  </Button>
                </DialogFooter>
              </>
            )}
          </Dialog>
        </CardContent>
      </Card>

      {selectedAthlete && (
        <Card>
          <CardContent className="p-6">
            {isKpiLoading ? (
              <div className="flex items-center justify-center py-6">
                <Icon name="progress_activity" className="animate-spin text-primary text-xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    LnRMSSD 7j
                  </p>
                  <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                    {latestSelectedPoint?.ln_rmssd_7d_avg?.toFixed(3) ?? "—"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Moyenne glissante sur 7 jours
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Bande SWC
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {latestSelectedPoint?.swc_low_28d?.toFixed(3) ?? "—"} / {latestSelectedPoint?.swc_high_28d?.toFixed(3) ?? "—"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Basée sur les 28 jours précédents
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Signal coach
                  </p>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${getSwcBadge(latestSelectedPoint?.swc_status ?? null).className}`}
                  >
                    <Icon
                      name={getSwcBadge(latestSelectedPoint?.swc_status ?? null).icon}
                      className="text-base"
                    />
                    {getSwcBadge(latestSelectedPoint?.swc_status ?? null).label}
                    <span className="text-xs opacity-80">
                      {getSwcBadge(latestSelectedPoint?.swc_status ?? null).detail}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Recommendation
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {latestSelectedPoint?.swc_recommendation ?? "—"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Low/rest si la moyenne 7j sort de la SWC
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div
              className={`${
                alertCount > 0
                  ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              } p-3 rounded-sm`}
            >
              <Icon name="health_and_safety" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Alertes SWC
              </p>
              <h3
                className={`text-2xl font-semibold font-mono ${
                  alertCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {alertCount}
              </h3>
              <p
                className={`text-xs font-medium mt-1 ${
                  alertCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {alertCount > 0
                  ? `${alertCount} athlete${alertCount > 1 ? "s" : ""} hors bande SWC`
                  : "Aucune alerte SWC détectée"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-sm">
              <Icon name="groups" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Cohorte dans SWC
              </p>
              <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                {readinessPct}%
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {signalReadyCount > 0
                  ? `${okCount}/${signalReadyCount} signaux exploitables restent dans la bande`
                  : "Pas assez d'historique pour établir le signal"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-3 rounded-sm">
              <Icon name="history" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Derniere Sync
              </p>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {lastSyncLabel}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {lastSyncRow?.athlete ?? "--"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Icon name="vital_signs" className="text-slate-400" />
            Mesures
          </div>
          <select
            value={selectedAthleteId}
            onChange={(event) => setSelectedAthleteId(event.target.value)}
            className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">Tous les athletes</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.first_name} {athlete.last_name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <SortableHeader
                  label="Athlete"
                  active={sortBy === "athlete"}
                  direction={sortDir}
                  onToggle={() => handleSort("athlete")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="Date"
                  active={sortBy === "date"}
                  direction={sortDir}
                  onToggle={() => handleSort("date")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="rMSSD (ms)"
                  active={sortBy === "rmssd"}
                  direction={sortDir}
                  onToggle={() => handleSort("rmssd")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="FC repos"
                  active={sortBy === "resting_hr"}
                  direction={sortDir}
                  onToggle={() => handleSort("resting_hr")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="Signal SWC"
                  active={sortBy === "swc"}
                  direction={sortDir}
                  onToggle={() => handleSort("swc")}
                  className="px-6 py-3"
                />
                <th className="px-6 py-3">Reco</th>
                <SortableHeader
                  label="Poids"
                  active={sortBy === "weight"}
                  direction={sortDir}
                  onToggle={() => handleSort("weight")}
                  className="px-6 py-3"
                />
                <th className="px-6 py-3">Sommeil</th>
                <th className="px-6 py-3">Énergie</th>
                <th className="px-6 py-3">Fatigue</th>
                <th className="px-6 py-3">Lifestyle</th>
                <th className="px-6 py-3">Sickness</th>
                <th className="px-6 py-3">Alcohol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Aucune donnee de readiness disponible.
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => {
                  const swcBadge = getSwcBadge(row.swc_status);
                  return (
                    <tr
                      key={`${row.athlete_id}-${row.date}`}
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <Link
                          to={`/athletes/${row.athlete_id}/trends`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {row.athlete.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {row.athlete}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDateLabel(row.date)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-900 dark:text-white font-semibold whitespace-nowrap">
                        {formatScore(row.rmssd_matinal)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.fc_repos !== null ? `${row.fc_repos.toFixed(1)} bpm` : "--"}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${swcBadge.className}`}
                        >
                          <Icon name={swcBadge.icon} className="text-sm" />
                          {swcBadge.label}
                          <span className="opacity-80">{swcBadge.detail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.swc_recommendation ?? "--"}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.poids !== null ? `${row.poids} kg` : "--"}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatScore(row.sleep_quality)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatScore(row.mental_energy)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatScore(row.fatigue)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatScore(row.lifestyle)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {row.sickness ? (
                          <Badge variant={row.sickness === "not sick" ? "slate" : "amber"}>
                            {row.sickness}
                          </Badge>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {row.alcohol ? (
                          <Badge variant={row.alcohol === "nothing" ? "slate" : "amber"}>
                            {row.alcohol}
                          </Badge>
                        ) : (
                          "--"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500 font-medium">
            Affichage de 1 a {filteredData.length} sur {filteredData.length} mesure{filteredData.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled>
              Precedent
            </Button>
            <Button variant="secondary" size="sm" disabled>
              Suivant
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
