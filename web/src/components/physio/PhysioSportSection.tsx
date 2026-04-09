import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SlidingTabs, type SlidingTabItem } from "@/components/ui/SlidingTabs";
import { cn } from "@/lib/cn";
import { speedToPace } from "@/services/format.service";
import {
  getPhysioProfileStateBadgeVariant,
  getPhysioProfileStateDescription,
  getPhysioProfileStateLabel,
  PHYSIO_PROFILE_STATE_ORDER,
} from "@/services/physio.service";
import type { PhysioProfile, PhysioProfileState } from "@/types/physio";
import { format } from "date-fns";

type SupportedSport = "Bike" | "Run";

interface Props {
  athleteId: string;
  sport: SupportedSport;
  profiles: PhysioProfile[];
  onAddProfile: (profile: Omit<PhysioProfile, "id">) => Promise<void>;
  titleClassName?: string;
}

interface BikeFormValues {
  ftp: string;
  weight: string;
  lt1Hr: string;
  lt2Hr: string;
  cpMontee: string;
  cpHt: string;
}

interface RunFormValues {
  lt1Pace: string;
  lt2Pace: string;
  lt1Hr: string;
  lt2Hr: string;
}

const EMPTY_BIKE_FORM: BikeFormValues = {
  ftp: "",
  weight: "",
  lt1Hr: "",
  lt2Hr: "",
  cpMontee: "",
  cpHt: "",
};

const EMPTY_RUN_FORM: RunFormValues = {
  lt1Pace: "",
  lt2Pace: "",
  lt1Hr: "",
  lt2Hr: "",
};

const SPORT_META: Record<SupportedSport, { title: string; icon: string }> = {
  Bike: { title: "Profil Vélo", icon: "directions_bike" },
  Run: { title: "Profil Course", icon: "directions_run" },
};

function buildBikeFormState(): Record<PhysioProfileState, BikeFormValues> {
  return {
    fresh: { ...EMPTY_BIKE_FORM },
    semi_fatigued: { ...EMPTY_BIKE_FORM },
    fatigued: { ...EMPTY_BIKE_FORM },
  };
}

function buildRunFormState(): Record<PhysioProfileState, RunFormValues> {
  return {
    fresh: { ...EMPTY_RUN_FORM },
    semi_fatigued: { ...EMPTY_RUN_FORM },
    fatigued: { ...EMPTY_RUN_FORM },
  };
}

function buildArchiveOpenState(): Record<PhysioProfileState, boolean> {
  return {
    fresh: false,
    semi_fatigued: false,
    fatigued: false,
  };
}

function paceToSpeed(pace: string): number | null {
  const parts = pace.split(":");
  if (parts.length !== 2) return null;
  const min = parseInt(parts[0]!, 10);
  const sec = parseInt(parts[1]!, 10);
  if (Number.isNaN(min) || Number.isNaN(sec)) return null;
  const totalSec = min * 60 + sec;
  if (totalSec <= 0) return null;
  return 1000 / totalSec;
}

function formatDate(value: string | null): string {
  if (!value) return "--";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return "--";
  }
}

function getPrimaryArchiveValue(profile: PhysioProfile, sport: SupportedSport): string {
  if (sport === "Bike") {
    return profile.cp_cs != null ? `${profile.cp_cs} W` : "--";
  }
  return profile.lt1_power_pace != null ? speedToPace(profile.lt1_power_pace) : "--";
}

export function PhysioSportSection({
  athleteId,
  sport,
  profiles,
  onAddProfile,
  titleClassName,
}: Props) {
  const [selectedProfileState, setSelectedProfileState] = useState<PhysioProfileState>("fresh");
  const [bikeForms, setBikeForms] = useState<Record<PhysioProfileState, BikeFormValues>>(buildBikeFormState);
  const [runForms, setRunForms] = useState<Record<PhysioProfileState, RunFormValues>>(buildRunFormState);
  const [archiveOpen, setArchiveOpen] = useState<Record<PhysioProfileState, boolean>>(buildArchiveOpenState);

  const activeProfiles = profiles.filter((profile) => !profile.valid_to);
  const archivedProfiles = profiles.filter((profile) => !!profile.valid_to);
  const meta = SPORT_META[sport];
  const stateTabs: SlidingTabItem<PhysioProfileState>[] = PHYSIO_PROFILE_STATE_ORDER.map((profileState) => ({
    key: profileState,
    label: getPhysioProfileStateLabel(profileState),
    shortLabel:
      profileState === "fresh"
        ? "Frais"
        : profileState === "semi_fatigued"
          ? "Semi"
          : "Fatigué",
  }));

  async function handleAddBikeProfile(profileState: PhysioProfileState) {
    const values = bikeForms[profileState];
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: athleteId,
      sport,
      profile_state: profileState,
      cp_cs: values.ftp ? parseFloat(values.ftp) : null,
      weight: values.weight ? parseFloat(values.weight) : null,
      lt1_hr: values.lt1Hr ? parseFloat(values.lt1Hr) : null,
      lt2_hr: values.lt2Hr ? parseFloat(values.lt2Hr) : null,
      cp_montee: values.cpMontee ? parseFloat(values.cpMontee) : null,
      cp_ht: values.cpHt ? parseFloat(values.cpHt) : null,
      lt1_power_pace: null,
      lt2_power_pace: null,
      vma: null,
      valid_from: new Date().toISOString(),
      valid_to: null,
    };
    await onAddProfile(profile);
    setBikeForms((current) => ({
      ...current,
      [profileState]: { ...EMPTY_BIKE_FORM },
    }));
  }

  async function handleAddRunProfile(profileState: PhysioProfileState) {
    const values = runForms[profileState];
    const profile: Omit<PhysioProfile, "id"> = {
      athlete_id: athleteId,
      sport,
      profile_state: profileState,
      vma: null,
      lt2_power_pace: values.lt2Pace ? paceToSpeed(values.lt2Pace) : null,
      lt1_hr: values.lt1Hr ? parseFloat(values.lt1Hr) : null,
      lt2_hr: values.lt2Hr ? parseFloat(values.lt2Hr) : null,
      cp_cs: null,
      weight: null,
      cp_montee: null,
      cp_ht: null,
      lt1_power_pace: values.lt1Pace ? paceToSpeed(values.lt1Pace) : null,
      valid_from: new Date().toISOString(),
      valid_to: null,
    };
    await onAddProfile(profile);
    setRunForms((current) => ({
      ...current,
      [profileState]: { ...EMPTY_RUN_FORM },
    }));
  }

  function toggleArchive(profileState: PhysioProfileState) {
    setArchiveOpen((current) => ({
      ...current,
      [profileState]: !current[profileState],
    }));
  }

  return (
    <div className="space-y-6">
      <h2 className={cn("text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white", titleClassName)}>
        <Icon name={meta.icon} className="text-slate-400" />
        {meta.title}
      </h2>

      <div className="flex justify-start">
        <SlidingTabs
          items={stateTabs}
          value={selectedProfileState}
          onChange={setSelectedProfileState}
          rounded="xl"
          className="max-w-full"
        />
      </div>

      {(() => {
        const profileState = selectedProfileState;
        const activeProfile = activeProfiles.find((profile) => profile.profile_state === profileState) ?? null;
        const archivedForState = archivedProfiles.filter((profile) => profile.profile_state === profileState);
        const stateLabel = getPhysioProfileStateLabel(profileState);
        const stateDescription = getPhysioProfileStateDescription(profileState);
        const badgeVariant = getPhysioProfileStateBadgeVariant(profileState);
        const bikeValues = bikeForms[profileState];
        const runValues = runForms[profileState];

        return (
          <Card key={`${sport}-${profileState}`} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Profil {stateLabel}</h3>
                  <p className="mt-1 text-sm text-slate-500">{stateDescription}</p>
                </div>
                <Badge variant={badgeVariant}>{stateLabel}</Badge>
              </div>

              <div className="space-y-4 p-5">
                {activeProfile ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Profil actif</h4>
                        <p className="text-xs font-medium text-slate-500">Dernier test : {formatDate(activeProfile.valid_from)}</p>
                      </div>
                      <Badge variant="orange">ACTIF</Badge>
                    </div>

                    {sport === "Bike" ? (
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">CP/FTP</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                              {activeProfile.cp_cs != null ? `${activeProfile.cp_cs} W` : "--"}
                            </span>
                            {activeProfile.cp_cs != null && activeProfile.weight != null && activeProfile.weight > 0 && (
                              <span className="text-sm font-medium text-slate-500">
                                {(activeProfile.cp_cs / activeProfile.weight).toFixed(1)} W/kg
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">CP Montée</p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.cp_montee != null ? `${activeProfile.cp_montee} W` : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT1 <span className="ml-1 text-accent-blue">Aérobie</span></p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt1_hr != null ? `${activeProfile.lt1_hr} bpm` : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT2 <span className="ml-1 text-accent-orange">Anaérobie</span></p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt2_hr != null ? `${activeProfile.lt2_hr} bpm` : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">CP Home Trainer</p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.cp_ht != null ? `${activeProfile.cp_ht} W` : "--"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allure LT1</p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt1_power_pace != null ? speedToPace(activeProfile.lt1_power_pace) : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allure LT2</p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt2_power_pace != null ? speedToPace(activeProfile.lt2_power_pace) : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT1 <span className="ml-1 text-accent-blue">Aérobie</span></p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt1_hr != null ? `${activeProfile.lt1_hr} bpm` : "--"}
                          </span>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT2 <span className="ml-1 text-accent-orange">Anaérobie</span></p>
                          <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                            {activeProfile.lt2_hr != null ? `${activeProfile.lt2_hr} bpm` : "--"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/70 px-5 py-5 text-sm text-slate-500 dark:border-slate-800">
                    Aucun profil actif pour l&apos;état {stateLabel.toLowerCase()}.
                  </div>
                )}

                <div className="rounded-2xl border border-dashed border-slate-300 bg-transparent px-5 py-5 transition-all duration-150 hover:border-primary dark:border-slate-700 dark:hover:border-primary">
                  <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Icon name="add_circle" className="text-slate-400" />
                    Ajouter un profil {meta.title.replace("Profil ", "").trim()} {stateLabel}
                  </h4>

                  {sport === "Bike" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">FTP (W)</label>
                          <Input type="number" placeholder="Ex: 250" value={bikeValues.ftp} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], ftp: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Poids (kg)</label>
                          <Input type="number" placeholder="Ex: 70.5" value={bikeValues.weight} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], weight: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT1 (bpm)</label>
                          <Input type="number" placeholder="Ex: 140" value={bikeValues.lt1Hr} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt1Hr: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT2 (bpm)</label>
                          <Input type="number" placeholder="Ex: 165" value={bikeValues.lt2Hr} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt2Hr: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">CP Montée (W)</label>
                          <Input type="number" placeholder="Optionnel" value={bikeValues.cpMontee} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], cpMontee: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">CP Home Trainer (W)</label>
                          <Input type="number" placeholder="Optionnel" value={bikeValues.cpHt} onChange={(event) => setBikeForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], cpHt: event.target.value },
                          }))} />
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => void handleAddBikeProfile(profileState)}>Créer le profil</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allure LT1 (mm:ss/km)</label>
                          <Input type="text" placeholder="Ex: 4:30" value={runValues.lt1Pace} onChange={(event) => setRunForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt1Pace: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allure LT2 (mm:ss/km)</label>
                          <Input type="text" placeholder="Ex: 3:45" value={runValues.lt2Pace} onChange={(event) => setRunForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt2Pace: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT1 (bpm)</label>
                          <Input type="number" placeholder="Ex: 145" value={runValues.lt1Hr} onChange={(event) => setRunForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt1Hr: event.target.value },
                          }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC LT2 (bpm)</label>
                          <Input type="number" placeholder="Ex: 170" value={runValues.lt2Hr} onChange={(event) => setRunForms((current) => ({
                            ...current,
                            [profileState]: { ...current[profileState], lt2Hr: event.target.value },
                          }))} />
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => void handleAddRunProfile(profileState)}>Créer le profil</Button>
                    </div>
                  )}
                </div>

                {archivedForState.length === 0 ? (
                  <p className="text-xs text-slate-400">Aucun profil archivé</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => toggleArchive(profileState)}
                      className="flex w-full items-center justify-between px-4 py-3 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-3">
                        <Icon name="history" className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {archivedForState.length} profil{archivedForState.length > 1 ? "s" : ""} archivé{archivedForState.length > 1 ? "s" : ""}
                        </span>
                        <Badge variant="slate">ARCHIVÉ</Badge>
                      </div>
                      <Icon name={archiveOpen[profileState] ? "expand_less" : "expand_more"} className="text-slate-400" />
                    </button>
                    {archiveOpen[profileState] && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {archivedForState.map((profile) => (
                          <div key={profile.id} className="flex items-center justify-between bg-white/40 px-4 py-3 opacity-80 dark:bg-slate-900/40">
                            <p className="text-xs font-medium text-slate-500">
                              {formatDate(profile.valid_from)} → {formatDate(profile.valid_to)}
                            </p>
                            <span className="text-sm font-semibold font-mono text-slate-600 dark:text-slate-400">
                              {getPrimaryArchiveValue(profile, sport)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
