import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { clearRecovery } = useAuth();
  const navigate = useNavigate();

  const validate = (): string | null => {
    if (password.length < 6) return "Le mot de passe doit contenir au moins 6 caractères.";
    if (password !== confirmPassword) return "Les mots de passe ne correspondent pas.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      clearRecovery();
      // Déconnecter pour forcer une reconnexion avec le nouveau mdp
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 w-full max-w-[440px] flex flex-col items-center mb-8">
        <img
          src="/ks-logo.png"
          alt="KS Endurance Training"
          className="h-20 w-auto mb-4 dark:brightness-90"
        />
        <p className="text-sm text-slate-500 mt-1">
          Nouveau mot de passe
        </p>
      </div>

      <div className="z-10 w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <Icon name="check_circle" className="text-green-600 dark:text-green-400 text-2xl" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Mot de passe modifié
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Votre mot de passe a été mis à jour. Vous allez être redirigé vers la page de connexion.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-4"
            >
              <Icon name="arrow_back" className="text-base" />
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl p-3 flex items-center gap-2">
                <Icon name="error" className="text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                  {error}
                </span>
              </div>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choisissez votre nouveau mot de passe.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon="lock"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Confirmer le mot de passe
              </label>
              <Input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Réinitialiser le mot de passe
                  <Icon name="lock_reset" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
