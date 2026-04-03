import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
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
  onCreateGroup: (name: string, color: string) => Promise<string | null>;
  onUpdateGroup: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onReorderGroups: (items: { id: string; sort_order: number }[]) => Promise<void>;
  onUpdateAthleteGroup: (athleteId: string, groupId: string | null) => Promise<void>;
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
  onUpdateAthleteGroup,
}: GroupManagerProps) {
  // Expanded group
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]!);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog
  const [editGroup, setEditGroup] = useState<AthleteGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<AthleteGroup | null>(null);

  // Add-to-group dialog
  const [addToGroupTarget, setAddToGroupTarget] = useState<AthleteGroup | null>(null);
  const [addAthleteIds, setAddAthleteIds] = useState<Set<string>>(new Set());

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    const name = newName.trim();
    const color = newColor;
    const athleteIds = [...selectedAthleteIds];
    setShowCreate(false);
    setNewName("");
    setNewColor(COLOR_PALETTE[0]!);
    setSelectedAthleteIds(new Set());
    const groupId = await onCreateGroup(name, color);
    if (groupId && athleteIds.length > 0) {
      await Promise.all(athleteIds.map((id) => onUpdateAthleteGroup(id, groupId)));
    }
    setIsCreating(false);
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
                            className="flex items-center gap-2 py-1 pl-2 pr-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-150 group/row"
                          >
                            <Link
                              to={`/athletes/${a.id}/bilan`}
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <AthleteAvatar firstName={a.first_name} lastName={a.last_name} avatarUrl={a.avatar_url} size="xs" shape="rounded" />
                              <span className="text-xs text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors truncate">
                                {a.first_name} {a.last_name}
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => void onUpdateAthleteGroup(a.id, null)}
                              className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all duration-150 shrink-0"
                              title="Retirer du groupe"
                            >
                              <Icon name="close" className="text-sm" />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddToGroupTarget(group);
                          setAddAthleteIds(new Set());
                        }}
                        className="flex items-center gap-1.5 py-1 pl-2 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        <Icon name="person_add" className="text-sm" />
                        Ajouter des athlètes
                      </button>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Athlètes
              {selectedAthleteIds.size > 0 && (
                <span className="ml-2 text-xs text-primary font-normal">
                  ({selectedAthleteIds.size} sélectionné{selectedAthleteIds.size > 1 ? "s" : ""})
                </span>
              )}
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {athletes.filter((a) => a.is_active).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 px-3">Aucun athlète actif</p>
              ) : (
                athletes
                  .filter((a) => a.is_active)
                  .map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAthleteIds.has(a.id)}
                        onChange={() => {
                          setSelectedAthleteIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                      />
                      <AthleteAvatar firstName={a.first_name} lastName={a.last_name} avatarUrl={a.avatar_url} size="xs" shape="rounded" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {a.first_name} {a.last_name}
                      </span>
                    </label>
                  ))
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => void handleCreate()} disabled={!newName.trim() || isCreating}>
            {isCreating ? "Création..." : "Créer"}
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

      {/* Add Athletes to Group Dialog */}
      <Dialog open={addToGroupTarget !== null} onClose={() => setAddToGroupTarget(null)}>
        <DialogHeader>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Ajouter des athlètes à "{addToGroupTarget?.name}"
          </h3>
          <button
            onClick={() => setAddToGroupTarget(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-150"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </DialogHeader>
        <DialogBody>
          {(() => {
            const available = athletes.filter(
              (a) => a.is_active && a.athlete_group_id !== addToGroupTarget?.id
            );
            if (available.length === 0) {
              return (
                <p className="text-sm text-slate-400 italic py-2">
                  Tous les athlètes actifs sont déjà dans ce groupe.
                </p>
              );
            }
            return (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {available.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={addAthleteIds.has(a.id)}
                      onChange={() => {
                        setAddAthleteIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(a.id)) next.delete(a.id);
                          else next.add(a.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                    />
                    <AthleteAvatar firstName={a.first_name} lastName={a.last_name} avatarUrl={a.avatar_url} size="xs" shape="rounded" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {a.first_name} {a.last_name}
                    </span>
                  </label>
                ))}
              </div>
            );
          })()}
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={addAthleteIds.size === 0}
            onClick={() => {
              if (!addToGroupTarget) return;
              const groupId = addToGroupTarget.id;
              const ids = [...addAthleteIds];
              setAddToGroupTarget(null);
              setAddAthleteIds(new Set());
              void Promise.all(ids.map((id) => onUpdateAthleteGroup(id, groupId)));
            }}
          >
            Ajouter ({addAthleteIds.size})
          </Button>
          <Button variant="secondary" onClick={() => setAddToGroupTarget(null)}>
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Supprimer le groupe{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deleteTarget?.name}"
            </span>{" "}
            ? Cette action est irréversible.
            {deleteTarget && (athleteCountByGroup[deleteTarget.id] ?? 0) > 0 && (
              <span className="block mt-2 text-slate-500 dark:text-slate-400">
                Les {athleteCountByGroup[deleteTarget.id]} athlète(s) du groupe seront dissocié(s) mais pas supprimé(s).
              </span>
            )}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => void handleDelete()}
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
