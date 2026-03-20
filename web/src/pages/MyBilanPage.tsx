import { useMyAthleteProfile } from "@/hooks/useMyAthleteProfile";
import { AthleteBilanPage } from "./AthleteBilanPage";
import { Icon } from "@/components/ui/Icon";

export function MyBilanPage() {
  const { profile, isLoading } = useMyAthleteProfile();

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Icon name="progress_activity" className="animate-spin text-4xl text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-red-500">Profil athlète introuvable</div>;
  }

  return <AthleteBilanPage athleteId={profile.id} />;
}
