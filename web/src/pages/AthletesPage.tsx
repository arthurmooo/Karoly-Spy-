import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { GroupManager } from "@/components/groups/GroupManager";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { useAthleteManagement } from "@/hooks/useAthleteManagement";
import { useAthleteGroups } from "@/hooks/useAthleteGroups";
import { toast } from "sonner";
import type { Athlete } from "@/types/athlete";

type AthleteSortBy = "name" | "group" | "status" | "since";
type StatusFilter = "all" | "active" | "inactive";

export function AthletesPage() {
  const navigate = useNavigate();
  const { athletes, isLoading, invite, updateGroup, toggleActive } =
    useAthleteManagement();
  const {
    groups,
    getGroupById,
    createGroup,
    updateGroup: updateGroupDef,
    deleteGroup,
    reorderGroups,
  } = useAthleteGroups();

  // Filters
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<AthleteSortBy>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Deactivate confirm dialog
  const [deactivateTarget, setDeactivateTarget] = useState<Athlete | null>(null);

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", first_name: "", last_name: "", athlete_group_id: "" });
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    setIsInviting(true);
    try {
      await invite({
        ...inviteForm,
        athlete_group_id: inviteForm.athlete_group_id || null,
      });
      setShowInviteDialog(false);
      setInviteForm({ email: "", first_name: "", last_name: "", athlete_group_id: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // Athlete count by group (for GroupManager)
  const athleteCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of athletes) {
      if (a.athlete_group_id) {
        counts[a.athlete_group_id] = (counts[a.athlete_group_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [athletes]);

  // Filtering
  const filtered = athletes.filter((a) => {
    if (groupFilter !== "all" && a.athlete_group_id !== groupFilter) return false;
    if (statusFilter === "active" && !a.is_active) return false;
    if (statusFilter === "inactive" && a.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
      if (!fullName.includes(q) && !(a.email?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Sorting
  const sorted = sortRows(
    filtered,
    (row) => {
      switch (sortBy) {
        case "name":
          return `${row.last_name} ${row.first_name}`;
        case "group":
          return getGroupById(row.athlete_group_id)?.sort_order ?? 99;
        case "status":
          return row.is_active ? 0 : 1;
        case "since":
          return row.start_date ? new Date(row.start_date) : null;
        default:
          return row.last_name;
      }
    },
    sortDir
  );

  const handleSort = (col: AthleteSortBy) => {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir(col === "since" ? "desc" : "asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    await toggleActive(deactivateTarget.id, deactivateTarget.is_active);
    setDeactivateTarget(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "--";
    try {
      return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
    } catch {
      return iso;
    }
  };

  const activeCount = athletes.filter((a) => a.is_active).length;
  const inactiveCount = athletes.filter((a) => !a.is_active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon
          name="progress_activity"
          className="animate-spin text-primary text-3xl"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <Icon name="groups" className="text-slate-400" />
          Gestion des Athlètes
        </h2>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Icon name="person_add" />
          Inviter un athlète
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl">
              <Icon name="groups" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Total
              </p>
              <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                {athletes.length}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                athlète{athletes.length !== 1 ? "s" : ""} enregistré{athletes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl">
              <Icon name="check_circle" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Actifs
              </p>
              <h3 className="text-2xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                athlète{activeCount !== 1 ? "s" : ""} actif{activeCount !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-3 rounded-xl">
              <Icon name="person_off" className="text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Inactifs
              </p>
              <h3 className="text-2xl font-semibold font-mono text-slate-500 dark:text-slate-400">
                {inactiveCount}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                athlète{inactiveCount !== 1 ? "s" : ""} inactif{inactiveCount !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Group Manager */}
      <GroupManager
        groups={groups}
        athletes={athletes}
        athleteCountByGroup={athleteCountByGroup}
        onCreateGroup={createGroup}
        onUpdateGroup={updateGroupDef}
        onDeleteGroup={deleteGroup}
        onReorderGroups={reorderGroups}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <Input
            icon="search"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">Tous les groupes</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <SortableHeader
                  label="Nom"
                  active={sortBy === "name"}
                  direction={sortDir}
                  onToggle={() => handleSort("name")}
                  className="px-6 py-3"
                />
                <th className="px-6 py-3">Email</th>
                <SortableHeader
                  label="Groupe"
                  active={sortBy === "group"}
                  direction={sortDir}
                  onToggle={() => handleSort("group")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="Statut"
                  active={sortBy === "status"}
                  direction={sortDir}
                  onToggle={() => handleSort("status")}
                  className="px-6 py-3"
                />
                <SortableHeader
                  label="Depuis"
                  active={sortBy === "since"}
                  direction={sortDir}
                  onToggle={() => handleSort("since")}
                  className="px-6 py-3"
                />
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Aucun athlète trouvé.
                  </td>
                </tr>
              ) : (
                sorted.map((athlete) => {
                  const group = getGroupById(athlete.athlete_group_id);
                  return (
                    <tr
                      key={athlete.id}
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-150 cursor-pointer"
                      onClick={() => navigate(`/athletes/${athlete.id}/profile`)}
                    >
                      {/* Name */}
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {athlete.first_name.charAt(0)}
                            {athlete.last_name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {athlete.first_name} {athlete.last_name}
                          </span>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {athlete.email ?? "--"}
                      </td>
                      {/* Group — inline select + badge */}
                      <td className="px-6 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={athlete.athlete_group_id ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateGroup(athlete.id, val || null);
                          }}
                          className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">Non assigné</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        {group && (
                          <span
                            className="ml-2 inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-6 py-3 whitespace-nowrap">
                        <Badge
                          variant={athlete.is_active ? "emerald" : "red"}
                        >
                          {athlete.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      {/* Since */}
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(athlete.start_date)}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {athlete.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeactivateTarget(athlete)}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Icon name="person_off" className="text-sm" />
                            Désactiver
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(athlete.id, false)}
                            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          >
                            <Icon name="person_add" className="text-sm" />
                            Réactiver
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500 font-medium">
            {filtered.length} athlète{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
            {" "}sur {athletes.length} au total
          </span>
        </div>
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
      >
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Confirmer la désactivation
          </h3>
          <button
            onClick={() => setDeactivateTarget(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Êtes-vous sûr de vouloir désactiver{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {deactivateTarget?.first_name} {deactivateTarget?.last_name}
            </span>{" "}
            ? L'athlète n'apparaîtra plus dans les listes actives mais ses données seront conservées.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => void handleDeactivateConfirm()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Icon name="person_off" />
            Désactiver
          </Button>
          <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Invite Athlete Dialog */}
      <Dialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
      >
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Inviter un athlète
          </h3>
          <button
            onClick={() => setShowInviteDialog(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                icon="email"
                type="email"
                placeholder="athlete@email.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <Input
                  icon="person"
                  placeholder="Prénom"
                  value={inviteForm.first_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Nom"
                  value={inviteForm.last_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Groupe
              </label>
              <select
                value={inviteForm.athlete_group_id}
                onChange={(e) => setInviteForm((f) => ({ ...f, athlete_group_id: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Aucun groupe</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => void handleInvite()}
            disabled={isInviting || !inviteForm.email || !inviteForm.first_name || !inviteForm.last_name}
          >
            {isInviting ? (
              <Icon name="progress_activity" className="animate-spin" />
            ) : (
              <Icon name="send" />
            )}
            {isInviting ? "Envoi..." : "Inviter"}
          </Button>
          <Button variant="secondary" onClick={() => setShowInviteDialog(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
