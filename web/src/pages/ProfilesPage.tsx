import { useState, useEffect } from "react";
import { PhysioSportSection } from "@/components/physio/PhysioSportSection";
import { useAthletes } from "@/hooks/useAthletes";
import { usePhysio } from "@/hooks/usePhysio";
import { isBikePhysioSport, isRunPhysioSport } from "@/services/physio.service";

export function ProfilesPage() {
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const { profiles, addProfile, isLoading: physioLoading } = usePhysio(selectedAthleteId);

  // Default to first athlete when athletes load
  useEffect(() => {
    if (athletes.length > 0 && !selectedAthleteId) {
      setSelectedAthleteId(athletes[0]!.id);
    }
  }, [athletes, selectedAthleteId]);

  const bikeProfiles = profiles.filter((profile) => isBikePhysioSport(profile.sport));
  const runProfiles = profiles.filter((profile) => isRunPhysioSport(profile.sport));

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
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">La MLS utilise toujours le profil frais.</p>
        </div>
        <div className="w-64">
          <select
            value={selectedAthleteId ?? ""}
            onChange={(e) => setSelectedAthleteId(e.target.value || null)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
          <PhysioSportSection athleteId={selectedAthleteId} sport="Bike" profiles={bikeProfiles} onAddProfile={addProfile} />
          <PhysioSportSection athleteId={selectedAthleteId} sport="Run" profiles={runProfiles} onAddProfile={addProfile} />
        </div>
      )}

      {/* Footer Légende Clinique */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex gap-4">
          <div className="w-1.5 bg-accent-blue rounded-full shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">LT1 "Seuil Aérobie"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Limite supérieure de l'endurance fondamentale. Au-delà, la concentration de lactate commence à augmenter légèrement au-dessus du niveau de repos.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1.5 bg-accent-orange rounded-full shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">LT2 "Seuil Anaérobie"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Intensité maximale où la production et l'élimination du lactate s'équilibrent. Au-delà, l'accumulation est rapide et la fatigue imminente.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-1.5 bg-primary rounded-full shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">FTP/CP "Puissance Seuil"</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Puissance mécanique maximale qu'un athlète peut théoriquement maintenir pendant environ 60 minutes sans fatigue excessive.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
