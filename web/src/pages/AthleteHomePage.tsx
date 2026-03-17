import { useAuth } from "@/hooks/useAuth";

export function AthleteHomePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
        Mon espace
      </h1>
      <p className="text-slate-600 dark:text-slate-400 text-lg">
        Bienvenue{user?.email ? `, ${user.email}` : ""}.
      </p>
      <p className="text-slate-500 dark:text-slate-500 mt-2">
        Votre espace personnel est en cours de construction. Calendrier, fiches séance et tendances HRV arrivent bientôt.
      </p>
    </div>
  );
}
