import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { assignAthleteCoach, listStructureAthleteAssignments, listStructureCoaches } from "@/repositories/admin.repository";
import type { StructureAthleteAssignment, StructureCoach } from "@/types/admin";

const FILTER_ALL = "all";
const FILTER_UNASSIGNED = "__unassigned__";

function formatDate(value: string | null) {
  if (!value) return "--";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: fr });
  } catch {
    return value;
  }
}

export function AdminAssignmentsPage() {
  const [athletes, setAthletes] = useState<StructureAthleteAssignment[]>([]);
  const [coaches, setCoaches] = useState<StructureCoach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCoachId, setFilterCoachId] = useState(FILTER_ALL);
  const [search, setSearch] = useState("");
  const [pendingAthleteId, setPendingAthleteId] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      const [coachRows, athleteRows] = await Promise.all([
        listStructureCoaches(),
        listStructureAthleteAssignments(),
      ]);
      setCoaches(coachRows);
      setAthletes(athleteRows);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des affectations");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const coachOptions = useMemo(
    () => coaches.filter((coach) => coach.is_active),
    [coaches]
  );

  const coachById = useMemo(
    () => new Map(coaches.map((coach) => [coach.id, coach])),
    [coaches]
  );

  const filteredAthletes = useMemo(() => {
    return athletes.filter((athlete) => {
      if (filterCoachId === FILTER_UNASSIGNED && athlete.coach_id !== null) return false;
      if (filterCoachId !== FILTER_ALL && filterCoachId !== FILTER_UNASSIGNED && athlete.coach_id !== filterCoachId) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const fullName = `${athlete.first_name} ${athlete.last_name}`.toLowerCase();
      const coachName = coachById.get(athlete.coach_id ?? "")?.display_name.toLowerCase() ?? "";
      return fullName.includes(q) || athlete.email?.toLowerCase().includes(q) || coachName.includes(q);
    });
  }, [athletes, coachById, filterCoachId, search]);

  async function handleAssignmentChange(athleteId: string, coachId: string) {
    setPendingAthleteId(athleteId);
    try {
      await assignAthleteCoach(athleteId, coachId || null);
      setAthletes((prev) =>
        prev.map((athlete) =>
          athlete.id === athleteId
            ? { ...athlete, coach_id: coachId || null }
            : athlete
        )
      );
      toast.success("Affectation mise a jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la reaffectation");
      await refresh();
    } finally {
      setPendingAthleteId(null);
    }
  }

  const assignedCount = athletes.filter((athlete) => athlete.coach_id).length;
  const unassignedCount = athletes.length - assignedCount;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Repartition des athletes</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Vue structure-wide reservee a l'admin pour assigner et reassigner les athletes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Athletes</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-slate-900 dark:text-white">{athletes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignes</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">{assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Non assignes</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-amber-600 dark:text-amber-400">{unassignedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <Input
            icon="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un athlete ou un coach..."
            className="md:max-w-sm"
          />
          <SearchableSelect
            value={filterCoachId}
            onChange={setFilterCoachId}
            options={[
              { value: FILTER_ALL, label: "Tous les coachs" },
              { value: FILTER_UNASSIGNED, label: "Non assignes" },
              ...coaches.map((coach) => ({
                value: coach.id,
                label: `${coach.display_name}${coach.role === "admin" ? " (Admin)" : ""}`,
              })),
            ]}
            placeholder="Tous les coachs"
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Athlete</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Depuis</th>
                <th className="px-6 py-3">Coach assigne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    <Icon name="progress_activity" className="animate-spin text-primary text-2xl inline-flex" />
                  </td>
                </tr>
              ) : filteredAthletes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    Aucun athlete sur ce filtre.
                  </td>
                </tr>
              ) : (
                filteredAthletes.map((athlete) => {
                  const coach = athlete.coach_id ? coachById.get(athlete.coach_id) ?? null : null;
                  return (
                    <tr key={athlete.id} data-testid={`admin-assignment-${athlete.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <AthleteAvatar firstName={athlete.first_name} lastName={athlete.last_name} size="md" shape="rounded" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {athlete.first_name} {athlete.last_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{athlete.email ?? "--"}</td>
                      <td className="px-6 py-4">
                        <Badge variant={athlete.is_active ? "emerald" : "slate"}>
                          {athlete.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(athlete.start_date)}</td>
                      <td className="px-6 py-4">
                        <SearchableSelect
                          value={athlete.coach_id ?? ""}
                          onChange={(v) => void handleAssignmentChange(athlete.id, v)}
                          disabled={pendingAthleteId === athlete.id}
                          options={[
                            { value: "", label: "Non assigne" },
                            ...coachOptions.map((coachOption) => ({
                              value: coachOption.id,
                              label: `${coachOption.display_name}${coachOption.role === "admin" ? " (Admin)" : ""}`,
                            })),
                          ]}
                          placeholder="Non assigne"
                          className="min-w-[220px]"
                        />
                        <p className="mt-1 text-xs text-slate-400">
                          {coach ? `Actuel: ${coach.display_name}` : "Pool non assigne"}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
