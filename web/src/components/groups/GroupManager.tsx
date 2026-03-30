import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import {
  Disclosure,
  DisclosureTrigger,
  DisclosureContent,
} from "@/components/ui/Disclosure";
import type { Athlete, AthleteGroup } from "@/types/athlete";

const COLOR_PALETTE = [
  "#2563EB",
  "#F97316",
  "#64748B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
];

interface GroupManagerProps {
  groups: AthleteGroup[];
  athletes: Athlete[];
  athleteCountByGroup: Record<string, number>;
  onCreateGroup: (name: string, color: string) => Promise<void>;
  onUpdateGroup: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onReorderGroups: (items: { id: string; sort_order: number }[]) => Promise<void>;
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full transition-all"
          style={{
            backgroundColor: color,
            boxShadow: value === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export function GroupManager({
  groups,
  athletes,
  athleteCountByGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onReorderGroups,
}: GroupManagerProps) {
  const navigate = useNavigate();

  // Expanded group
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]!);

  // Edit dialog
  const [editGroup, setEditGroup] = useState<AthleteGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<AthleteGroup | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    setShowCreate(false);
    const name = newName.trim();
    const color = newColor;
    setNewName("");
    setNewColor(COLOR_PALETTE[0]!);
    void onCreateGroup(name, color);
  };

  const handleEdit = () => {
    if (!editGroup || !editName.trim()) return;
    const id = editGroup.id;
    const updates = { name: editName.trim(), color: editColor };
    setEditGroup(null);
    void onUpdateGroup(id, updates);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    void onDeleteGroup(id);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const prev = groups[index - 1]!;
    const curr = groups[index]!;
    const items = groups.map((g, i) => ({
      id: g.id,
      sort_order: i === index ? prev.sort_order : i === index - 1 ? curr.sort_order : g.sort_order,
    }));
    void onReorderGroups(items);
  };

  const handleMoveDown = (index: number) => {
    if (index === groups.length - 1) return;
    const next = groups[index + 1]!;
    const curr = groups[index]!;
    const items = groups.map((g, i) => ({
      id: g.id,
      sort_order: i === index ? next.sort_order : i === index + 1 ? curr.sort_order : g.sort_order,
    }));
    void onReorderGroups(items);
  };

  return (
    <Card>
      <Disclosure>
        <DisclosureTrigger className="w-full">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="folder_open" className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Groupes d'athlètes
              </span>
              <span className="text-xs text-slate-400 font-medium">({groups.length})</span>
            </div>
            <Icon name="expand_more" className="text-slate-400 text-xl" />
          </CardContent>
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Group list */}
            {groups.map((group, index) => {
              const count = athleteCountByGroup[group.id] ?? 0;
              const isExpanded = expandedGroupId === group.id;
              const groupAthletes = athletes.filter(
                (a) => a.athlete_group_id === group.id
              );
              return (
                <div key={group.id}>
                  <div
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
                    onClick={() =>
                      setExpandedGroupId(isExpanded ? null : group.id)
                    }
                  >
                    <Icon
                      name={isExpanded ? "expand_more" : "chevron_right"}
                      className="text-slate-400 text-sm shrink-0"
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white flex-1">
                      {group.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {count} athl.
                    </span>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-all duration-150"
                      >
                        <Icon name="keyboard_arrow_up" className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === groups.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-all duration-150"
                      >
                        <Icon name="keyboard_arrow_down" className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditGroup(group);
                          setEditName(group.name);
                          setEditColor(group.color);
                        }}
                        className="p-1 text-slate-400 hover:text-primary transition-all duration-150"
                      >
                        <Icon name="edit" className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(group)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-all duration-150"
                      >
                        <Icon name="delete" className="text-sm" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="ml-8 mt-1 mb-1 space-y-0.5">
                      {groupAthletes.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1 pl-2">
                          Aucun athlète dans ce groupe
                        </p>
                      ) : (
                        groupAthletes.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 py-1 pl-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-150"
                            onClick={() => navigate(`/athletes/${a.id}/bilan`)}
                          >
                            <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-400 shrink-0">
                              {a.first_name.charAt(0)}
                              {a.last_name.charAt(0)}
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors">
                              {a.first_name} {a.last_name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(true)}
              className="w-full justify-center text-primary"
            >
              <Icon name="add" className="text-sm" />
              Ajouter un groupe
            </Button>
          </div>
        </DisclosureContent>
      </Disclosure>

      {/* Create Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Nouveau groupe
          </h3>
          <button
            onClick={() => setShowCreate(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nom
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Compétiteur"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Couleur
            </label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => void handleCreate()} disabled={!newName.trim()}>
            Créer
          </Button>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editGroup !== null} onClose={() => setEditGroup(null)}>
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Modifier le groupe
          </h3>
          <button
            onClick={() => setEditGroup(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nom
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Couleur
            </label>
            <ColorPicker value={editColor} onChange={setEditColor} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => void handleEdit()} disabled={!editName.trim()}>
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={() => setEditGroup(null)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Supprimer le groupe
          </h3>
          <button
            onClick={() => setDeleteTarget(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody>
          {deleteTarget && (athleteCountByGroup[deleteTarget.id] ?? 0) > 0 ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              Impossible de supprimer le groupe{" "}
              <span className="font-semibold">"{deleteTarget?.name}"</span> : il contient{" "}
              {athleteCountByGroup[deleteTarget.id]} athlète(s). Réassignez-les d'abord.
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Supprimer le groupe{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                "{deleteTarget?.name}"
              </span>{" "}
              ? Cette action est irréversible.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => void handleDelete()}
            disabled={
              deleteTarget != null &&
              (athleteCountByGroup[deleteTarget.id] ?? 0) > 0
            }
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Supprimer
          </Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Annuler
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
