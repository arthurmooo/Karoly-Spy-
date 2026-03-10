import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAthletes } from "@/hooks/useAthletes";
import { usePhysio } from "@/hooks/usePhysio";
import { speedToPace } from "@/services/format.service";
import { isBikePhysioSport, isRunPhysioSport } from "@/services/physio.service";
import { format } from "date-fns";
import type { PhysioProfile } from "@/types/physio";

export function ProfilesPage() {
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const { activeProfiles, archivedProfiles, addProfile, isLoading: physioLoading } = usePhysio(selectedAthleteId);

  // Default to first athlete when athletes load
  useEffect(() => {
    if (athletes.length > 0 && !selectedAthleteId) {
      setSelectedAthleteId(athletes[0]!.id);
    }
  }, [athletes, selectedAthleteId]);

  // --- Bike form state ---
  const [bikeFtp, setBikeFtp] = useState("");
  const [bikeWeight, setBikeWeight] = useState("");
  const [bikeLt1Hr, setBikeLt1Hr] = useState("");
  const [bikeLt2Hr, setBikeLt2Hr] = useState("");
  const [bikeCpMontee, setBikeCpMontee] = useState("");
  const [bikeCpHt, setBikeCpHt] = useState("");

  // --- Run form state ---
  const [runVma, setRunVma] = useState("");
  const [runLt2Pace, setRunLt2Pace] = useState("");
  const [runLt1Hr, setRunLt1Hr] = useState("");
  const [runLt2Hr, setRunLt2Hr] = useState("");

  // Split profiles by sport
  const activeBike = activeProfiles.find((p) => isBikePhysioSport(p.sport));
  const activeRun = activeProfiles.find((p) => isRunPhysioSport(p.sport));
  const archivedBike = archivedProfiles.filter((p) => isBikePhysioSport(p.sport));
  const archivedRun = archivedProfiles.filter((p) => isRunPhysioSport(p.sport));

  // Helper: parse "mm:ss" pace string to m/s
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
      return format(new Date(d), "dd/MM/yyyy");
    } catch {
      return "--";
    }
  }

  async function handleAddBikeProfile() {
    if (!selectedAthleteId) return;
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: selectedAthleteId,
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
    setBikeFtp("");
    setBikeWeight("");
    setBikeLt1Hr("");
    setBikeLt2Hr("");
    setBikeCpMontee("");
    setBikeCpHt("");
  }

  async function handleAddRunProfile() {
    if (!selectedAthleteId) return;
    const lt2Speed = runLt2Pace ? paceToSpeed(runLt2Pace) : null;
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: selectedAthleteId,
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
    setRunVma("");
    setRunLt2Pace("");
    setRunLt1Hr("");
    setRunLt2Hr("");
  }

  if (athletesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Profils de Performance</h1>
          <p className="text-sm text-slate-500 mt-1">Suivi des seuils metaboliques, FTP et zones de frequence cardiaque.</p>
        </div>
        <div className="w-64">
          <select
            value={selectedAthleteId ?? ""}
            onChange={(e) => setSelectedAthleteId(e.target.value || null)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">-- Sélectionnez un athlète --</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedAthleteId ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-slate-500">Sélectionnez un athlète</p>
        </div>
      ) : physioLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne Vélo */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="directions_bike" className="text-slate-400" />
              Profil Vélo
            </h2>

            {/* Profil Actif */}
            {activeBike ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Profil de Saison</h3>
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

            {/* Formulaire Ajout */}
            <Card className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors bg-transparent shadow-none">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Icon name="add_circle" className="text-slate-400" />
                  Ajouter un profil Vélo
                </h3>
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
                <Button className="w-full mt-2" onClick={handleAddBikeProfile}>Créer le profil</Button>
              </CardContent>
            </Card>

            {/* Profils Archivés */}
            <div className="space-y-3">
              {archivedBike.length === 0 ? (
                <p className="text-xs text-slate-400">Aucun profil archivé</p>
              ) : (
                archivedBike.map((prof) => (
                  <Card key={prof.id} className="bg-white/60 dark:bg-slate-900/60 opacity-75">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon name="history" className="text-slate-400" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Profil Précédent</p>
                          <p className="text-xs text-slate-500 font-medium">
                            {formatDate(prof.valid_from)} → {formatDate(prof.valid_to)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold font-mono text-slate-700 dark:text-slate-300">
                          {prof.cp_cs != null ? `${prof.cp_cs} W` : "--"}
                        </span>
                        <Badge variant="slate">ARCHIVÉ</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Colonne Course */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="directions_run" className="text-slate-400" />
              Profil Course
            </h2>

            {/* Profil Actif */}
            {activeRun ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Profil de Saison</h3>
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

            {/* Formulaire Ajout */}
            <Card className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors bg-transparent shadow-none">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Icon name="add_circle" className="text-slate-400" />
                  Ajouter un profil Course
                </h3>
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
                <Button className="w-full mt-2" onClick={handleAddRunProfile}>Créer le profil</Button>
              </CardContent>
            </Card>

            {/* Profils Archivés */}
            <div className="space-y-3">
              {archivedRun.length === 0 ? (
                <p className="text-xs text-slate-400">Aucun profil archivé</p>
              ) : (
                archivedRun.map((prof) => (
                  <Card key={prof.id} className="bg-white/60 dark:bg-slate-900/60 opacity-75">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon name="history" className="text-slate-400" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Profil Précédent</p>
                          <p className="text-xs text-slate-500 font-medium">
                            {formatDate(prof.valid_from)} → {formatDate(prof.valid_to)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold font-mono text-slate-700 dark:text-slate-300">
                          {prof.vma != null ? `${prof.vma} km/h` : "--"}
                        </span>
                        <Badge variant="slate">ARCHIVÉ</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Légende Clinique */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex gap-4">
          <div className="w-1.5 bg-accent-blue rounded-sm shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">LT1 "Seuil Aérobie"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Limite supérieure de l'endurance fondamentale. Au-delà, la concentration de lactate commence à augmenter légèrement au-dessus du niveau de repos.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1.5 bg-accent-orange rounded-sm shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">LT2 "Seuil Anaérobie"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Intensité maximale où la production et l'élimination du lactate s'équilibrent. Au-delà, l'accumulation est rapide et la fatigue imminente.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1.5 bg-primary rounded-sm shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">FTP/CP "Puissance Seuil"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Puissance mécanique maximale qu'un athlète peut théoriquement maintenir pendant environ 60 minutes sans fatigue excessive.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
