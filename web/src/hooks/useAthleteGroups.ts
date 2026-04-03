import { useState, useEffect, useCallback } from "react";
import { getAthleteGroups, manageAthleteGroup } from "@/repositories/group.repository";
import type { AthleteGroup } from "@/types/athlete";
import { toast } from "sonner";

export function useAthleteGroups() {
  const [groups, setGroups] = useState<AthleteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getAthleteGroups()
      .then(setGroups)
      .catch((err) => {
        console.error(err);
        toast.error("Erreur lors du chargement des groupes");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getGroupById = useCallback(
    (id: string | null): AthleteGroup | undefined => {
      if (!id) return undefined;
      return groups.find((g) => g.id === id);
    },
    [groups]
  );

  const createGroup = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      const nextOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0;
      // Optimistic
      const tempId = crypto.randomUUID();
      const tempGroup: AthleteGroup = { id: tempId, name, color, sort_order: nextOrder };
      setGroups((prev) => [...prev, tempGroup]);
      try {
        const result = await manageAthleteGroup({ action: "create", name, color });
        toast.success("Groupe créé");
        refresh();
        return result?.group?.id ?? null;
      } catch (err) {
        refresh();
        toast.error(err instanceof Error ? err.message : "Erreur lors de la création du groupe");
        return null;
      }
    },
    [groups, refresh]
  );

  const updateGroup = useCallback(
    async (groupId: string, updates: { name?: string; color?: string }) => {
      // Optimistic
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
      );
      try {
        await manageAthleteGroup({ action: "update", group_id: groupId, ...updates });
        toast.success("Groupe mis à jour");
      } catch (err) {
        refresh();
        toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour du groupe");
      }
    },
    [refresh]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const prev = groups;
      setGroups((g) => g.filter((x) => x.id !== groupId));
      try {
        await manageAthleteGroup({ action: "delete", group_id: groupId });
        toast.success("Groupe supprimé");
      } catch (err) {
        setGroups(prev);
        toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression du groupe");
      }
    },
    [groups]
  );

  const reorderGroups = useCallback(
    async (items: { id: string; sort_order: number }[]) => {
      // Optimistic
      setGroups((prev) =>
        prev
          .map((g) => {
            const item = items.find((i) => i.id === g.id);
            return item ? { ...g, sort_order: item.sort_order } : g;
          })
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      try {
        await manageAthleteGroup({ action: "reorder", items });
      } catch (err) {
        refresh();
        toast.error(err instanceof Error ? err.message : "Erreur lors du réordonnement");
      }
    },
    [refresh]
  );

  return { groups, isLoading, refresh, getGroupById, createGroup, updateGroup, deleteGroup, reorderGroups };
}
