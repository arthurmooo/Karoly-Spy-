import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { SPORT_ICONS, SPORT_COLORS } from "@/lib/constants";
import { useActivities } from "@/hooks/useActivities";
import { useAthletes } from "@/hooks/useAthletes";

const SPORT_OPTIONS = [
  { value: "CAP", label: "Course à pied" },
  { value: "VELO", label: "Vélo" },
  { value: "NAT", label: "Natation" },
  { value: "SKI", label: "Ski de fond" },
  { value: "TRI", label: "Triathlon" },
  { value: "MUSC", label: "Musculation" },
];

const WORK_TYPE_OPTIONS = [
  { value: "endurance", label: "Endurance" },
  { value: "competition", label: "Compétition" },
  { value: "intervals", label: "Fractionné" },
];

export function ActivitiesPage() {
  const navigate = useNavigate();
  const {
    activities,
    total,
    page,
    perPage,
    isLoading,
    setPage,
    setAthlete,
    setSport,
    setWorkType,
    setDateFrom,
    setDateTo,
    setSearch,
  } = useActivities();
  const { athletes } = useAthletes();

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : page * perPage + 1;
  const rangeEnd = Math.min((page + 1) * perPage, total);

  // Compute stats from current page activities
  const avgMls =
    activities.filter((a) => a.mls != null).length > 0
      ? (
          activities
            .filter((a) => a.mls != null)
            .reduce((sum, a) => sum + (a.mls ?? 0), 0) /
          activities.filter((a) => a.mls != null).length
        ).toFixed(1)
      : "--";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
            <span>Accueil</span>
            <Icon name="chevron_right" className="text-lg" />
            <span className="text-primary font-semibold">Journal d'Activités</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Journal d'Activités</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez et analysez les performances de vos athlètes en temps réel.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            disabled
            title="L'export CSV n'est pas branché dans cette version de la web app."
          >
            <Icon name="download" />
            Exporter CSV
          </Button>
          <Button
            disabled
            title="La création de séance n'est pas branchée dans cette version de la web app."
          >
            <Icon name="add" />
            Nouvelle Activité
          </Button>
        </div>
      </div>

      <FeatureNotice
        title="Actions visibles mais non branchées"
        description="Cette page est reliée aux activités Supabase, mais l'export CSV et la création manuelle de séance n'ont pas encore de backend exploitable dans la web app."
        status="partial"
      />

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <select
          onChange={(e) => setAthlete(e.target.value || null)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Tous les athlètes</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.first_name} {a.last_name}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => setSport(e.target.value || null)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Tous les sports</option>
          {SPORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => setWorkType(e.target.value || null)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Tous les types</option>
          {WORK_TYPE_OPTIONS.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <Input
          type="date"
          onChange={(e) => setDateFrom(e.target.value || null)}
        />

        <Input
          type="date"
          onChange={(e) => setDateTo(e.target.value || null)}
        />

        <Input
          icon="search"
          placeholder="Rechercher une séance..."
          onChange={(e) => setSearch(e.target.value || null)}
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Athlète</th>
                <th className="px-4 py-3">Sport</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">MLS</th>
                <th className="px-4 py-3">FC Moy</th>
                <th className="px-4 py-3">Allure / Puissance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="progress_activity" className="text-3xl text-primary animate-spin" />
                      <span className="text-sm text-slate-500">Chargement des activités...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <span className="text-sm text-slate-500">Aucune activité trouvée.</span>
                  </td>
                </tr>
              ) : (
                activities.map((act) => {
                  const sportKey = act.sport.toUpperCase();

                  return (
                    <tr
                      key={act.id}
                      onClick={() => navigate(`/activities/${act.id}`)}
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {format(new Date(act.date), "dd MMM yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {act.athlete.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="whitespace-nowrap">{act.athlete}</div>
                            <div className="max-w-[130px] truncate text-xs text-slate-500 dark:text-slate-400">
                              {act.title}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Icon name={SPORT_ICONS[sportKey] ?? "exercise"} className={SPORT_COLORS[sportKey] ?? ""} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{act.sport}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={
                            act.work_type === "Compétition" ? "orange" : act.work_type === "Endurance" ? "primary" : "slate"
                          }
                        >
                          {act.work_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{act.duration}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{act.distance}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {act.mls != null ? (
                          <Badge variant={act.mls > 7 ? "red" : act.mls > 5 ? "orange" : act.mls > 3 ? "amber" : "emerald"}>
                            {act.mls.toFixed(1)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{act.hr}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{act.pace}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500">
            {total === 0
              ? "Aucune activité"
              : `Affichage de ${rangeStart} à ${rangeEnd} sur ${total} activités`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <Icon name="chevron_left" />
            </Button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <Icon name="chevron_right" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Activités</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">{total}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">MLS Moyen</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">{avgMls}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Volume</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">--</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Score de Récupération</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">--</h3>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
