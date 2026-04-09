import { useOutletContext, useParams } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { PhysioSportSection } from "@/components/physio/PhysioSportSection";
import { usePhysio } from "@/hooks/usePhysio";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { isBikePhysioSport, isRunPhysioSport } from "@/services/physio.service";
import type { AthleteDetailOutletContext } from "@/components/layout/AthleteDetailLayout";

export function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { athlete } = useOutletContext<AthleteDetailOutletContext>();
  const { profiles, freshActiveProfiles, addProfile, isLoading: physioLoading } = usePhysio(id ?? null);

  const athleteWeight = freshActiveProfiles.find((p) => p.weight != null)?.weight ?? null;
  const bikeProfiles = profiles.filter((profile) => isBikePhysioSport(profile.sport));
  const runProfiles = profiles.filter((profile) => isRunPhysioSport(profile.sport));

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
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          La MLS utilise toujours le profil frais.
        </p>
      </div>

      {physioLoading ? (
        <div className="flex items-center justify-center h-48">
          <Icon name="progress_activity" className="animate-spin text-primary text-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {id ? (
            <>
              <PhysioSportSection athleteId={id} sport="Bike" profiles={bikeProfiles} onAddProfile={addProfile} titleClassName="text-base" />
              <PhysioSportSection athleteId={id} sport="Run" profiles={runProfiles} onAddProfile={addProfile} titleClassName="text-base" />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
