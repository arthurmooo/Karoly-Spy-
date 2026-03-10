import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { useReadiness } from "@/hooks/useReadiness";
import { useAthletes } from "@/hooks/useAthletes";
import { insertHrvBatch } from "@/repositories/readiness.repository";
import { parseHrvCsv, matchEmailToAthlete } from "@/services/hrv.service";

type ImportStatus = "idle" | "importing" | "success" | "error";

export function HealthPage() {
  const [selectedAthleteId, setSelectedAthleteId] = useState("all");
  const { healthData, isLoading } = useReadiness();
  const { athletes } = useAthletes();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");

  /* ---------- Filtered data ---------- */
  const filteredData =
    selectedAthleteId === "all"
      ? healthData
      : healthData.filter((r) => r.athlete_id === selectedAthleteId);

  /* ---------- KPI computations ---------- */
  const alertCount = healthData.filter(
    (r) => r.tendance_rmssd_pct !== null && r.tendance_rmssd_pct < -10
  ).length;

  const okCount = healthData.filter(
    (r) => r.tendance_rmssd_pct === null || r.tendance_rmssd_pct > -5
  ).length;
  const readinessPct =
    healthData.length > 0
      ? Math.round((okCount / healthData.length) * 100)
      : 0;

  const lastSyncRow = healthData.length
    ? healthData.reduce((latest, r) => (r.date > latest.date ? r : latest))
    : null;

  const lastSyncLabel = lastSyncRow
    ? format(parseISO(lastSyncRow.date), "dd/MM/yyyy", { locale: fr })
    : "--";

  /* ---------- CSV import handler ---------- */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("importing");
    setImportMessage("");

    try {
      const text = await file.text();
      const parsed = parseHrvCsv(text);

      const batch: Array<{
        athlete_id: string;
        date: string;
        rmssd: number | null;
        resting_hr: number | null;
      }> = [];

      let skipped = 0;
      for (const row of parsed) {
        const matched = matchEmailToAthlete(row.email, athletes);
        if (!matched) {
          skipped++;
          continue;
        }
        batch.push({
          athlete_id: matched.id,
          date: row.date,
          rmssd: row.rmssd,
          resting_hr: row.resting_hr,
        });
      }

      if (batch.length === 0) {
        setImportStatus("error");
        setImportMessage(
          `Aucune ligne importable (${skipped} lignes sans correspondance email).`
        );
        return;
      }

      await insertHrvBatch(batch);
      setImportStatus("success");
      setImportMessage(
        `${batch.length} mesure${batch.length > 1 ? "s" : ""} importée${batch.length > 1 ? "s" : ""}` +
          (skipped > 0 ? ` (${skipped} ignorée${skipped > 1 ? "s" : ""})` : "")
      );
    } catch (err) {
      setImportStatus("error");
      setImportMessage(
        err instanceof Error ? err.message : "Erreur lors de l'import."
      );
    } finally {
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ---------- Format helpers ---------- */
  const formatDate = (iso: string) => {
    try {
      return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
    } catch {
      return iso;
    }
  };

  /* ---------- Render ---------- */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon name="progress_activity" className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <Icon name="analytics" className="text-slate-400" />
          Suivi Biometrique & Readiness
        </h2>
        <div className="flex items-center gap-4">
          <select
            value={selectedAthleteId}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
            className="w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">Tous les athletes</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>
          <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Icon name="notifications" className="text-2xl" />
            {alertCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent-orange rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>
          <Button
            disabled
            title="L'export PDF n'est pas branché dans cette version de la web app."
          >
            <Icon name="download" />
            Exporter PDF
          </Button>
        </div>
      </div>

      <FeatureNotice
        title="Export santé non branché"
        description="Le tableau et l'import CSV HRV4Training sont actifs. L'export PDF reste visible mais n'est pas relié à un générateur de document dans cette web app."
        status="partial"
      />

      {/* Import Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="upload_file" className="text-primary text-xl" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Import de donnees HRV4Training</h3>
            <Badge variant="slate">Format CSV requis</Badge>
            {importStatus === "success" && (
              <Badge variant="emerald">{importMessage}</Badge>
            )}
            {importStatus === "error" && (
              <Badge variant="red">{importMessage}</Badge>
            )}
            {importStatus === "importing" && (
              <Icon name="progress_activity" className="animate-spin text-primary text-sm" />
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
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }}
          >
            <div className="bg-accent-blue/10 rounded-sm p-4 mb-4">
              <Icon name="cloud_upload" className="text-accent-blue text-3xl" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Glissez-deposez votre export HRV4Training ici</p>
            <p className="text-xs text-slate-500 mb-4">Ou cliquez pour parcourir vos fichiers</p>
            <div className="font-mono bg-slate-100 dark:bg-slate-800 rounded p-2 text-xs text-slate-600 dark:text-slate-400">
              Format: email ; date ; heure ; FC repos ; rMSSD
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grille resume medical */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className={`${alertCount > 0 ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"} p-3 rounded-sm`}>
              <Icon name="health_and_safety" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Alertes de Sante</p>
              <h3 className={`text-2xl font-semibold font-mono ${alertCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{alertCount}</h3>
              <p className={`text-xs font-medium mt-1 ${alertCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {alertCount > 0
                  ? `${alertCount} athlete${alertCount > 1 ? "s" : ""} en baisse rMSSD > 10%`
                  : "Aucune anomalie detectee"}
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Readiness Cohorte</p>
              <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">{readinessPct}%</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {readinessPct >= 80
                  ? "Etat de forme global optimal pour l'entrainement"
                  : "Vigilance recommandee sur le groupe"}
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Derniere Sync</p>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{lastSyncLabel}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">{lastSyncRow?.athlete ?? "--"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau biometrique */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Athlete</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">rMSSD (ms)</th>
                <th className="px-6 py-3">FC repos</th>
                <th className="px-6 py-3">Tendance rMSSD</th>
                <th className="px-6 py-3">Poids</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    Aucune donnee de readiness disponible.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => {
                  const trend = row.tendance_rmssd_pct;
                  return (
                    <tr key={`${row.athlete_id}-${row.date}`} className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <Link to={`/athletes/${row.athlete_id}/trends`} className="flex items-center gap-2 hover:text-primary transition-colors">
                          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {row.athlete.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{row.athlete}</span>
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-900 dark:text-white font-semibold whitespace-nowrap">
                        {row.rmssd_matinal !== null ? row.rmssd_matinal.toFixed(1) : "--"}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.fc_repos !== null ? `${row.fc_repos} bpm` : "--"}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {trend !== null && trend > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            <Icon name="trending_up" className="text-sm" />
                            +{trend.toFixed(1)}%
                          </div>
                        ) : trend !== null && trend < -5 ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs font-medium">
                            <Icon name="trending_down" className="text-sm" />
                            {trend.toFixed(1)}%
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 text-xs font-medium">
                            <Icon name="horizontal_rule" className="text-sm" />
                            {trend !== null ? `${trend.toFixed(1)}%` : "--"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.poids !== null ? `${row.poids} kg` : "--"}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                          <Icon name="more_horiz" />
                        </button>
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
            <Button variant="secondary" size="sm" disabled>Precedent</Button>
            <Button variant="secondary" size="sm" disabled>Suivant</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
