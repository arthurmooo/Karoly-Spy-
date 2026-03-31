import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyAthleteProfile } from "@/hooks/useMyAthleteProfile";
import { usePhysio } from "@/hooks/usePhysio";
import { useAthleteGroups } from "@/hooks/useAthleteGroups";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useTheme } from "@/hooks/useTheme";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase";
import { speedToPace } from "@/services/format.service";
import { isBikePhysioSport, isRunPhysioSport } from "@/services/physio.service";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function MyProfilePage() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useMyAthleteProfile();
  const { activeProfiles, isLoading: physioLoading } = usePhysio(profile?.id ?? null);
  const { getGroupById } = useAthleteGroups();
  const { uploadAvatar, removeAvatar, isUploading } = useAvatarUpload(profile?.id ?? null);
  const { theme, toggleTheme } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Use local state for avatar (updated after upload), fallback to profile
  const displayAvatarUrl = avatarUrl ?? profile?.avatar_url ?? null;

  const activeBike = activeProfiles.find((p) => isBikePhysioSport(p.sport));
  const activeRun = activeProfiles.find((p) => isRunPhysioSport(p.sport));
  const group = profile?.athlete_group_id ? getGroupById(profile.athlete_group_id) : undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      if (url) {
        setAvatarUrl(url);
        toast.success("Photo de profil mise à jour");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    }
    // Reset input so re-selecting the same file triggers change
    e.target.value = "";
  }

  async function handleRemoveAvatar() {
    try {
      await removeAvatar();
      setAvatarUrl(null);
      toast.success("Photo supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  async function handlePasswordChange() {
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe modifié avec succès");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Erreur lors du changement de mot de passe");
    } finally {
      setIsChangingPassword(false);
    }
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return "--";
    try {
      return format(new Date(d), "d MMMM yyyy", { locale: fr });
    } catch {
      return "--";
    }
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="progress_activity" className="animate-spin text-primary text-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Icon name="error" className="text-3xl text-slate-400" />
        <p className="text-sm text-slate-500">Profil introuvable</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Mon profil</h1>
        <p className="text-sm text-slate-500 mt-1">Gérez vos informations personnelles et vos préférences.</p>
      </div>

      {/* ── Header: Avatar + identity ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            {/* Clickable avatar */}
            <button
              type="button"
              className="relative group shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <AthleteAvatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                avatarUrl={displayAvatarUrl}
                size="xl"
                shape="rounded"
                className={isUploading ? "opacity-50" : ""}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center">
                <Icon
                  name={isUploading ? "progress_activity" : "photo_camera"}
                  className={`text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isUploading ? "animate-spin opacity-100" : ""}`}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handleFileChange(e)}
              />
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white truncate">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-sm text-slate-500 truncate">{user?.email ?? profile.email ?? "--"}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={profile.is_active ? "emerald" : "red"}>
                  {profile.is_active ? "Actif" : "Inactif"}
                </Badge>
                {group && (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border"
                    style={{
                      backgroundColor: `${group.color}10`,
                      borderColor: `${group.color}30`,
                      color: group.color,
                    }}
                  >
                    {group.name}
                  </span>
                )}
              </div>
            </div>

            {/* Remove avatar button */}
            {displayAvatarUrl && (
              <button
                type="button"
                onClick={() => void handleRemoveAvatar()}
                disabled={isUploading}
                className="text-sm text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-150 self-start"
                title="Supprimer la photo"
              >
                <Icon name="delete" className="text-lg" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Informations personnelles ── */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="person" className="text-slate-400" />
            Informations personnelles
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoField label="Nom complet" value={`${profile.first_name} ${profile.last_name}`} />
            <InfoField label="Email" value={user?.email ?? profile.email ?? "--"} />
            <InfoField label="Coach" value="Karoly Spy" />
            <InfoField label="Groupe" value={group?.name ?? "Aucun"} />
            <InfoField label="Membre depuis" value={formatDate(profile.start_date)} />
            <InfoField label="Statut" value={profile.is_active ? "Actif" : "Inactif"} />
          </div>
        </CardContent>
      </Card>

      {/* ── Profil physiologique ── */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="fitness_center" className="text-slate-400" />
            Profil de performance
          </h3>

          {physioLoading ? (
            <div className="flex items-center justify-center h-24">
              <Icon name="progress_activity" className="animate-spin text-primary text-xl" />
            </div>
          ) : !activeBike && !activeRun ? (
            <p className="text-sm text-slate-500">Aucun profil physiologique enregistré.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Vélo */}
              {activeBike && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon name="directions_bike" className="text-slate-400 text-lg" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Vélo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PhysioStat label="FTP / CP" value={activeBike.cp_cs != null ? `${activeBike.cp_cs} W` : null} />
                    <PhysioStat label="Poids" value={activeBike.weight != null ? `${activeBike.weight} kg` : null} />
                    <PhysioStat label="FC LT1" value={activeBike.lt1_hr != null ? `${activeBike.lt1_hr} bpm` : null} />
                    <PhysioStat label="FC LT2" value={activeBike.lt2_hr != null ? `${activeBike.lt2_hr} bpm` : null} />
                  </div>
                </div>
              )}

              {/* Course */}
              {activeRun && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon name="directions_run" className="text-slate-400 text-lg" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Course</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PhysioStat label="VMA" value={activeRun.vma != null ? `${activeRun.vma} km/h` : null} />
                    <PhysioStat label="Allure LT2" value={activeRun.lt2_power_pace != null ? speedToPace(activeRun.lt2_power_pace) : null} />
                    <PhysioStat label="FC LT1" value={activeRun.lt1_hr != null ? `${activeRun.lt1_hr} bpm` : null} />
                    <PhysioStat label="FC LT2" value={activeRun.lt2_hr != null ? `${activeRun.lt2_hr} bpm` : null} />
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400 mt-2">
            Ces valeurs sont gérées par votre coach.
          </p>
        </CardContent>
      </Card>

      {/* ── Sécurité ── */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="lock" className="text-slate-400" />
            Sécurité
          </h3>

          <div className="space-y-4 max-w-sm">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Email de connexion
              </label>
              <p className="text-sm text-slate-700 dark:text-slate-300">{user?.email ?? "--"}</p>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Nouveau mot de passe
              </label>
              <Input
                type="password"
                placeholder="Min. 8 caractères"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Confirmer le mot de passe
              </label>
              <Input
                type="password"
                placeholder="Répétez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}

            <Button
              onClick={() => void handlePasswordChange()}
              disabled={isChangingPassword || !newPassword}
              size="sm"
            >
              {isChangingPassword ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-sm" />
                  Modification...
                </>
              ) : (
                "Changer le mot de passe"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Préférences ── */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="tune" className="text-slate-400" />
            Préférences
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Thème d'affichage</p>
              <p className="text-xs text-slate-500">
                {theme === "light" ? "Mode clair activé" : "Mode sombre activé"}
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150"
            >
              <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-lg" />
              {theme === "light" ? "Mode sombre" : "Mode clair"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function PhysioStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <span className="text-lg font-semibold font-mono text-slate-900 dark:text-white">
        {value ?? "--"}
      </span>
    </div>
  );
}
