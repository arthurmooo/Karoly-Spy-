import { useState, useEffect, useCallback } from "react";
import {
  getAllAthletes,
  inviteAthlete,
  manageAthlete,
} from "@/repositories/athlete.repository";
import type { Athlete } from "@/types/athlete";
import { toast } from "sonner";

export function useAthleteManagement() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getAllAthletes()
      .then(setAthletes)
      .catch((err) => {
        console.error(err);
        toast.error("Erreur lors du chargement des athlètes");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const invite = useCallback(
    async (payload: {
      email: string;
      first_name: string;
      last_name: string;
      athlete_group_id?: string | null;
    }) => {
      await inviteAthlete(payload);
      toast.success("Invitation envoyée");
      refresh();
    },
    [refresh]
  );

  const updateGroup = useCallback(
    async (athleteId: string, groupId: string | null) => {
      // Optimistic update
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, athlete_group_id: groupId } : a
        )
      );
      try {
        await manageAthlete({
          athlete_id: athleteId,
          action: "update_group",
          group_id: groupId,
        });
        toast.success("Groupe mis à jour");
      } catch (err) {
        refresh(); // rollback
        toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour du groupe");
      }
    },
    [refresh]
  );

  const toggleActive = useCallback(
    async (athleteId: string, currentlyActive: boolean) => {
      const action = currentlyActive ? "deactivate" : "reactivate";
      // Optimistic update
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId ? { ...a, is_active: !currentlyActive } : a
        )
      );
      try {
        await manageAthlete({ athlete_id: athleteId, action });
        toast.success(currentlyActive ? "Athlète désactivé" : "Athlète réactivé");
      } catch (err) {
        refresh(); // rollback
        toast.error(err instanceof Error ? err.message : "Erreur lors de la modification du statut");
      }
    },
    [refresh]
  );

  return { athletes, isLoading, refresh, invite, updateGroup, toggleActive };
}
