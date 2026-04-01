import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch {
      // Ne pas révéler si l'email existe ou non (sécurité)
      setSent(true);
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
          Réinitialisation du mot de passe
        </p>
      </div>

      <div className="z-10 w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <Icon name="mark_email_read" className="text-green-600 dark:text-green-400 text-2xl" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Email envoyé
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation dans quelques instants.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-4"
            >
              <Icon name="arrow_back" className="text-base" />
              Retour à la connexion
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
              Entrez votre adresse email. Vous recevrez un lien pour créer un nouveau mot de passe.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon="mail"
                required
                autoComplete="email"
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
                  Envoyer le lien
                  <Icon name="send" />
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Icon name="arrow_back" className="text-base" />
                Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
