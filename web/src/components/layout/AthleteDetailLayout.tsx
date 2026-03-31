import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { AthleteSubNav } from "@/components/layout/AthleteSubNav";
import { getAthleteById } from "@/repositories/athlete.repository";
import type { Athlete } from "@/types/athlete";

export interface AthleteDetailOutletContext {
  athlete: Athlete;
}

export function AthleteDetailLayout() {
  const { id } = useParams<{ id: string }>();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setAthlete(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAthleteById(id)
      .then((data) => { if (!cancelled) setAthlete(data); })
      .catch((err) => { console.error(err); if (!cancelled) setAthlete(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon name="progress_activity" className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <p className="text-sm text-slate-500">Athlète introuvable.</p>
        <Link to="/athletes">
          <Button variant="secondary">
            <Icon name="arrow_back" className="text-sm" />
            Retour aux athlètes
          </Button>
        </Link>
      </div>
    );
  }

  const initials = `${athlete.first_name.charAt(0)}${athlete.last_name.charAt(0)}`;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/athletes" className="flex items-center gap-1 hover:text-primary transition-colors">
          <Icon name="arrow_back" className="text-base" />
          Athlètes
        </Link>
        <Icon name="chevron_right" className="text-sm text-slate-400" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary border border-primary/20 shrink-0">
            {initials}
          </div>
          <span className="font-medium text-slate-900 dark:text-white">
            {athlete.first_name} {athlete.last_name}
          </span>
        </div>
      </div>

      {/* Tab nav — stays mounted across route changes */}
      <AthleteSubNav athleteId={athlete.id} />

      {/* Page content — changes on tab switch */}
      <Outlet context={{ athlete } satisfies AthleteDetailOutletContext} />
    </div>
  );
}
