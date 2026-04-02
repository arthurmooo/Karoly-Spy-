import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getRole } from "@/lib/auth/roles";
import { establishSessionFromEmailLink, resolvePostPasswordRoute } from "@/lib/auth/emailLink";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AcceptInvitePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function bootstrapInvite() {
      const result = await establishSessionFromEmailLink(supabase, "invite");
      if (cancelled) return;

      if (!result.ok) {
        setError(result.error ?? "Lien d'invitation invalide ou expire.");
        setIsReady(false);
        setIsChecking(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (!session) {
        setError("La session d'invitation n'a pas pu etre etablie.");
        setIsReady(false);
        setIsChecking(false);
        return;
      }

      setIsReady(true);
      setIsChecking(false);
    }

    void bootstrapInvite();

    return () => {
      cancelled = true;
    };
  }, []);

  function validate(): string | null {
    if (password.length < 6) return "Le mot de passe doit contenir au moins 6 caracteres.";
    if (password !== confirmPassword) return "Les mots de passe ne correspondent pas.";
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Session d'invitation introuvable.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      navigate(resolvePostPasswordRoute(getRole(profile?.role ?? null)), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de finaliser l'invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 w-full max-w-[440px] flex flex-col items-center mb-8">
        <img
          src="/ks-logo.png"
          alt="KS Endurance Training"
          className="h-20 w-auto mb-4 dark:brightness-90"
        />
        <p className="text-sm text-slate-500 mt-1">Finaliser l'invitation</p>
      </div>

      <div className="z-10 w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {isChecking ? (
          <div className="flex min-h-48 items-center justify-center">
            <Icon name="progress_activity" className="animate-spin text-primary text-3xl" />
          </div>
        ) : !isReady ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <Icon name="error" className="text-red-500 text-2xl" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Invitation invalide
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {error || "Ce lien est invalide, deja utilise ou a expire."}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Icon name="arrow_back" className="text-base" />
              Retour a la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl p-3 flex items-center gap-2">
                <Icon name="error" className="text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</span>
              </div>
            ) : null}

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choisissez un mot de passe pour activer votre acces.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="invite-password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Mot de passe
              </label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  icon="lock"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-confirm-password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Confirmer le mot de passe
              </label>
              <Input
                id="invite-confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                icon="lock"
                required
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-md font-semibold shadow-sm mt-2"
            >
              {isSubmitting ? (
                <Icon name="refresh" className="animate-spin" />
              ) : (
                <>
                  Activer mon acces
                  <Icon name="arrow_forward" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
