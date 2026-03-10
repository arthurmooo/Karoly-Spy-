import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      navigate("/dashboard");
    } catch (err: any) {
      setError("Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 w-full max-w-[440px] flex flex-col items-center mb-8">
        <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 w-16 h-16 rounded-sm shadow-sm flex items-center justify-center mb-4">
          <Icon name="directions_run" filled className="text-4xl text-white" />
        </div>
        <h1 className="text-2xl font-semibold uppercase text-slate-900 dark:text-white tracking-tight">
          KS Endurance Training
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Plateforme de coaching premium pour triathlètes
        </p>
      </div>

      <div className="z-10 w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-none p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-sm p-3 flex items-center gap-2">
              <Icon name="error" className="text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                {error}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              E-mail
            </label>
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon="mail"
              required
            />
          </div>

          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Mot de passe
              </label>
              <span className="text-xs font-medium text-slate-400">
                Mot de passe oublié non branché
              </span>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon="lock"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} />
              </button>
            </div>
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
                Se connecter
                <Icon name="arrow_forward" />
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="z-10 text-xs text-center text-slate-400 mt-6 font-medium">
        Nouveau sur la plateforme ? Demander un accès coach
      </p>

      {/* Décorations visuelles */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-16 opacity-40 pointer-events-none pb-8">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Icon name="analytics" className="text-3xl" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Analytics</span>
        </div>
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Icon name="timer" className="text-3xl" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Performance</span>
        </div>
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Icon name="query_stats" className="text-3xl" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Data-Driven</span>
        </div>
      </div>
    </div>
  );
}
