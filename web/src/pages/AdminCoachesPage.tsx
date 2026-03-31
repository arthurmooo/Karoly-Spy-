import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { inviteCoach, listStructureCoaches, updateCoachStatus } from "@/repositories/admin.repository";
import type { StructureCoach } from "@/types/admin";

export function AdminCoachesPage() {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<StructureCoach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", display_name: "" });
  const [isInviting, setIsInviting] = useState(false);
  const [pendingCoachId, setPendingCoachId] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setCoaches(await listStructureCoaches());
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des coachs");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const totals = useMemo(
    () => ({
      admins: coaches.filter((coach) => coach.role === "admin").length,
      activeCoaches: coaches.filter((coach) => coach.role === "coach" && coach.is_active).length,
      inactiveCoaches: coaches.filter((coach) => coach.role === "coach" && !coach.is_active).length,
    }),
    [coaches]
  );

  async function handleInvite() {
    setIsInviting(true);
    try {
      await inviteCoach(inviteForm);
      toast.success("Invitation coach envoyee");
      setInviteForm({ email: "", display_name: "" });
      setShowInviteDialog(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'invitation");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleToggleStatus(coach: StructureCoach) {
    setPendingCoachId(coach.id);
    try {
      await updateCoachStatus(coach.id, !coach.is_active);
      toast.success(coach.is_active ? "Coach desactive" : "Coach reactive");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la mise a jour");
    } finally {
      setPendingCoachId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Administration des coachs</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Le proprietaire gere les coachs de la structure et leur statut d'acces.
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)} data-testid="admin-invite-coach">
          <Icon name="person_add" />
          Inviter un coach
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admins</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-slate-900 dark:text-white">{totals.admins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coachs actifs</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">{totals.activeCoaches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coachs inactifs</p>
            <p className="mt-2 text-3xl font-semibold font-mono text-slate-500 dark:text-slate-400">{totals.inactiveCoaches}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Coach</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Athletes</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    <Icon name="progress_activity" className="animate-spin text-primary text-2xl inline-flex" />
                  </td>
                </tr>
              ) : coaches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Aucun coach dans la structure.
                  </td>
                </tr>
              ) : (
                coaches.map((coach) => {
                  const isSelf = coach.id === user?.id;
                  return (
                    <tr key={coach.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {coach.display_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{coach.display_name}</p>
                            {isSelf && (
                              <p className="text-xs text-slate-400">Votre compte</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{coach.email ?? "--"}</td>
                      <td className="px-6 py-4">
                        <Badge variant={coach.role === "admin" ? "primary" : "slate"}>
                          {coach.role === "admin" ? "Admin" : "Coach"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={coach.is_active ? "emerald" : "slate"}>
                          {coach.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-700 dark:text-slate-300">{coach.athlete_count}</td>
                      <td className="px-6 py-4">
                        {coach.role === "coach" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleStatus(coach)}
                            disabled={pendingCoachId === coach.id}
                          >
                            {pendingCoachId === coach.id ? (
                              <Icon name="progress_activity" className="animate-spin text-sm" />
                            ) : (
                              <Icon name={coach.is_active ? "person_off" : "person_add"} className="text-sm" />
                            )}
                            {coach.is_active ? "Desactiver" : "Reactiver"}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Proprietaire</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)}>
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Inviter un coach</h3>
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
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nom affiche</label>
              <Input
                icon="badge"
                placeholder="Steven Galibert"
                value={inviteForm.display_name}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, display_name: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input
                icon="mail"
                type="email"
                placeholder="coach@structure.fr"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => void handleInvite()}
            disabled={isInviting || !inviteForm.email.trim() || !inviteForm.display_name.trim()}
          >
            {isInviting ? (
              <Icon name="progress_activity" className="animate-spin" />
            ) : (
              <Icon name="send" />
            )}
            {isInviting ? "Envoi..." : "Envoyer l'invitation"}
          </Button>
          <Button variant="secondary" onClick={() => setShowInviteDialog(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
