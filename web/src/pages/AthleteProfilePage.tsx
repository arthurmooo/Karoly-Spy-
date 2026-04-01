import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePhysio } from "@/hooks/usePhysio";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { speedToPace } from "@/services/format.service";
import { isBikePhysioSport, isRunPhysioSport } from "@/services/physio.service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AthleteDetailOutletContext } from "@/components/layout/AthleteDetailLayout";
import type { PhysioProfile } from "@/types/physio";

export function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { athlete } = useOutletContext<AthleteDetailOutletContext>();

  const [bikeArchiveOpen, setBikeArchiveOpen] = useState(false);
  const [runArchiveOpen, setRunArchiveOpen] = useState(false);

  const { activeProfiles, archivedProfiles, addProfile, isLoading: physioLoading } = usePhysio(id ?? null);

  // Bike form
  const [bikeFtp, setBikeFtp] = useState("");
  const [bikeWeight, setBikeWeight] = useState("");
  const [bikeLt1Hr, setBikeLt1Hr] = useState("");
  const [bikeLt2Hr, setBikeLt2Hr] = useState("");
  const [bikeCpMontee, setBikeCpMontee] = useState("");
  const [bikeCpHt, setBikeCpHt] = useState("");

  // Run form
  const [runVma, setRunVma] = useState("");
  const [runLt2Pace, setRunLt2Pace] = useState("");
  const [runLt1Hr, setRunLt1Hr] = useState("");
  const [runLt2Hr, setRunLt2Hr] = useState("");

  const activeBike = activeProfiles.find((p) => isBikePhysioSport(p.sport));
  const activeRun = activeProfiles.find((p) => isRunPhysioSport(p.sport));
  const athleteWeight = activeProfiles.find((p) => p.weight != null)?.weight ?? null;
  const archivedBike = archivedProfiles.filter((p) => isBikePhysioSport(p.sport));
  const archivedRun = archivedProfiles.filter((p) => isRunPhysioSport(p.sport));

  function paceToSpeed(pace: string): number | null {
    const parts = pace.split(":");
    if (parts.length !== 2) return null;
    const min = parseInt(parts[0]!, 10);
    const sec = parseInt(parts[1]!, 10);
    if (isNaN(min) || isNaN(sec)) return null;
    const totalSec = min * 60 + sec;
    if (totalSec <= 0) return null;
    return 1000 / totalSec;
  }

  function formatDate(d: string | null): string {
    if (!d) return "--";
    try {
      return format(new Date(d), "dd/MM/yyyy", { locale: fr });
    } catch {
      return "--";
    }
  }

  async function handleAddBikeProfile() {
    if (!id) return;
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: id,
      sport: "Bike",
      cp_cs: bikeFtp ? parseFloat(bikeFtp) : null,
      weight: bikeWeight ? parseFloat(bikeWeight) : null,
      lt1_hr: bikeLt1Hr ? parseFloat(bikeLt1Hr) : null,
      lt2_hr: bikeLt2Hr ? parseFloat(bikeLt2Hr) : null,
      cp_montee: bikeCpMontee ? parseFloat(bikeCpMontee) : null,
      cp_ht: bikeCpHt ? parseFloat(bikeCpHt) : null,
      lt1_power_pace: null,
      lt2_power_pace: null,
      vma: null,
      valid_from: new Date().toISOString(),
      valid_to: null,
    };
    await addProfile(profile);
    setBikeFtp(""); setBikeWeight(""); setBikeLt1Hr(""); setBikeLt2Hr(""); setBikeCpMontee(""); setBikeCpHt("");
  }

  async function handleAddRunProfile() {
    if (!id) return;
    const lt2Speed = runLt2Pace ? paceToSpeed(runLt2Pace) : null;
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: id,
      sport: "Run",
      vma: runVma ? parseFloat(runVma) : null,
      lt2_power_pace: lt2Speed,
      lt1_hr: runLt1Hr ? parseFloat(runLt1Hr) : null,
      lt2_hr: runLt2Hr ? parseFloat(runLt2Hr) : null,
      cp_cs: null,
      weight: null,
      cp_montee: null,
      cp_ht: null,
      lt1_power_pace: null,
      valid_from: new Date().toISOString(),
      valid_to: null,
    };
    await addProfile(profile);
    setRunVma(""); setRunLt2Pace(""); setRunLt1Hr(""); setRunLt2Hr("");
  }

  return (
    <div className="space-y-8">
      {/* Athlete header */}
      <div className="flex items-center gap-4">
        <AthleteAvatar firstName={athlete.first_name} lastName={athlete.last_name} avatarUrl={athlete.avatar_url} size="xl" shape="rounded" className="bg-primary/10 dark:bg-primary/20 text-primary border-primary/20" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {athlete.first_name} {athlete.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {athlete.email && (
              <span className="text-sm text-slate-500">{athlete.email}</span>
            )}
            {athleteWeight != null && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Icon name="monitor_weight" className="text-sm text-slate-400" />
                {athleteWeight} kg
              </span>
            )}
            <Badge variant={athlete.is_active ? "emerald" : "red"}>
              {athlete.is_active ? "Actif" : "Inactif"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Section title */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon name="fitness_center" className="text-slate-400" />
          Profils de Performance
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Seuils métaboliques, FTP et zones de fréquence cardiaque.
        </p>
      </div>

      {physioLoading ? (
        <div className="flex items-center justify-center h-48">
          <Icon name="progress_activity" className="animate-spin text-primary text-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vélo */}
          <div className="space-y-6">
            <h3 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="directions_bike" className="text-slate-400" />
              Profil Vélo
            </h3>

            {activeBike ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Profil de Saison</h4>
                      <p className="text-xs text-slate-500 font-medium">Dernier test : {formatDate(activeBike.valid_from)}</p>
                    </div>
                    <Badge variant="orange">ACTIF</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">CP/FTP</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                          {activeBike.cp_cs != null ? `${activeBike.cp_cs} W` : "--"}
                        </span>
                        {activeBike.cp_cs != null && activeBike.weight != null && activeBike.weight > 0 && (
                          <span className="text-sm font-medium text-slate-500">
                            {(activeBike.cp_cs / activeBike.weight).toFixed(1)} W/kg
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">CP Montée</p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeBike.cp_montee != null ? `${activeBike.cp_montee} W` : "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">FC LT1 <span className="text-accent-blue ml-1">Aérobie</span></p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeBike.lt1_hr != null ? `${activeBike.lt1_hr} bpm` : "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">FC LT2 <span className="text-accent-orange ml-1">Anaérobie</span></p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeBike.lt2_hr != null ? `${activeBike.lt2_hr} bpm` : "--"}
                      </span>
                    </div>
                    {activeBike.cp_ht != null && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">CP Home Trainer</p>
                        <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                          {activeBike.cp_ht} W
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-slate-500">Aucun profil actif</p>
                </CardContent>
              </Card>
            )}

            <Card className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all duration-150 bg-transparent">
              <CardContent className="p-6 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Icon name="add_circle" className="text-slate-400" />
                  Ajouter un profil Vélo
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">FTP (W)</label>
                    <Input type="number" placeholder="Ex: 250" value={bikeFtp} onChange={(e) => setBikeFtp(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Poids (kg)</label>
                    <Input type="number" placeholder="Ex: 70.5" value={bikeWeight} onChange={(e) => setBikeWeight(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">FC LT1 (bpm)</label>
                    <Input type="number" placeholder="Ex: 140" value={bikeLt1Hr} onChange={(e) => setBikeLt1Hr(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">FC LT2 (bpm)</label>
                    <Input type="number" placeholder="Ex: 165" value={bikeLt2Hr} onChange={(e) => setBikeLt2Hr(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">CP Montée (W)</label>
                    <Input type="number" placeholder="Optionnel" value={bikeCpMontee} onChange={(e) => setBikeCpMontee(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">CP Home Trainer (W)</label>
                    <Input type="number" placeholder="Optionnel" value={bikeCpHt} onChange={(e) => setBikeCpHt(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full mt-2" onClick={() => void handleAddBikeProfile()}>Créer le profil</Button>
              </CardContent>
            </Card>

            {archivedBike.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  onClick={() => setBikeArchiveOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="history" className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {archivedBike.length} profil{archivedBike.length > 1 ? "s" : ""} archivé{archivedBike.length > 1 ? "s" : ""}
                    </span>
                    <Badge variant="slate">ARCHIVÉ</Badge>
                  </div>
                  <Icon name={bikeArchiveOpen ? "expand_less" : "expand_more"} className="text-slate-400" />
                </button>
                {bikeArchiveOpen && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {archivedBike.map((prof) => (
                      <div key={prof.id} className="px-4 py-3 flex items-center justify-between bg-white/40 dark:bg-slate-900/40 opacity-80">
                        <p className="text-xs text-slate-500 font-medium">
                          {formatDate(prof.valid_from)} → {formatDate(prof.valid_to)}
                        </p>
                        <span className="text-sm font-semibold font-mono text-slate-600 dark:text-slate-400">
                          {prof.cp_cs != null ? `${prof.cp_cs} W` : "--"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Course */}
          <div className="space-y-6">
            <h3 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="directions_run" className="text-slate-400" />
              Profil Course
            </h3>

            {activeRun ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Profil de Saison</h4>
                      <p className="text-xs text-slate-500 font-medium">Dernier test : {formatDate(activeRun.valid_from)}</p>
                    </div>
                    <Badge variant="orange">ACTIF</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">VMA</p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeRun.vma != null ? `${activeRun.vma} km/h` : "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Allure LT2</p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeRun.lt2_power_pace != null ? speedToPace(activeRun.lt2_power_pace) : "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">FC LT1 <span className="text-accent-blue ml-1">Aérobie</span></p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeRun.lt1_hr != null ? `${activeRun.lt1_hr} bpm` : "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">FC LT2 <span className="text-accent-orange ml-1">Anaérobie</span></p>
                      <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                        {activeRun.lt2_hr != null ? `${activeRun.lt2_hr} bpm` : "--"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-slate-500">Aucun profil actif</p>
                </CardContent>
              </Card>
            )}

            <Card className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all duration-150 bg-transparent">
              <CardContent className="p-6 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Icon name="add_circle" className="text-slate-400" />
                  Ajouter un profil Course
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">VMA (km/h)</label>
                    <Input type="number" placeholder="Ex: 18" value={runVma} onChange={(e) => setRunVma(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Allure LT2 (mm:ss/km)</label>
                    <Input type="text" placeholder="Ex: 3:45" value={runLt2Pace} onChange={(e) => setRunLt2Pace(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">FC LT1 (bpm)</label>
                    <Input type="number" placeholder="Ex: 145" value={runLt1Hr} onChange={(e) => setRunLt1Hr(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">FC LT2 (bpm)</label>
                    <Input type="number" placeholder="Ex: 170" value={runLt2Hr} onChange={(e) => setRunLt2Hr(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full mt-2" onClick={() => void handleAddRunProfile()}>Créer le profil</Button>
              </CardContent>
            </Card>

            {archivedRun.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  onClick={() => setRunArchiveOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="history" className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {archivedRun.length} profil{archivedRun.length > 1 ? "s" : ""} archivé{archivedRun.length > 1 ? "s" : ""}
                    </span>
                    <Badge variant="slate">ARCHIVÉ</Badge>
                  </div>
                  <Icon name={runArchiveOpen ? "expand_less" : "expand_more"} className="text-slate-400" />
                </button>
                {runArchiveOpen && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {archivedRun.map((prof) => (
                      <div key={prof.id} className="px-4 py-3 flex items-center justify-between bg-white/40 dark:bg-slate-900/40 opacity-80">
                        <p className="text-xs text-slate-500 font-medium">
                          {formatDate(prof.valid_from)} → {formatDate(prof.valid_to)}
                        </p>
                        <span className="text-sm font-semibold font-mono text-slate-600 dark:text-slate-400">
                          {prof.vma != null ? `${prof.vma} km/h` : "--"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
