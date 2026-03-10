import { useCalendar } from "@/hooks/useCalendar";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CalendarFilters } from "@/components/calendar/filters/CalendarFilters";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { FeatureNotice } from "@/components/ui/FeatureNotice";

export function CalendarPage() {
  const {
    view,
    currentDate,
    selectedAthleteId,
    selectedSport,
    days,
    stats,
    athletes,
    isLoading,
    plannedAvailable,
    setView,
    setAthlete,
    setSport,
    navigateDate,
    goToToday,
  } = useCalendar();

  return (
    <div className="space-y-6 flex flex-col h-full">
      <CalendarHeader
        view={view}
        currentDate={currentDate}
        onViewChange={setView}
        onNavigate={navigateDate}
      />

      <CalendarFilters
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        selectedSport={selectedSport}
        onAthleteChange={setAthlete}
        onSportChange={setSport}
        onTodayClick={goToToday}
      />

      {!plannedAvailable && (
        <FeatureNotice
          title="Séances planifiées indisponibles"
          description="La web app cible actuellement le projet Supabase `Project K`, où la table `planned_workouts` n'est pas exposée. Le calendrier affiche donc uniquement les séances réalisées."
          status="backend"
        />
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Icon name="refresh" className="animate-spin text-4xl text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <CalendarGrid view={view} days={days} />
          <CalendarLegend />
        </div>
      )}

      {/* Stats Résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Séances</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">{stats.totalSessions}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">cette période</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Volume</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
              {Math.floor(stats.totalDurationSec / 3600)}h {Math.floor((stats.totalDurationSec % 3600) / 60)}m
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">cette période</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Distance</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
              {(stats.totalDistanceM / 1000).toFixed(1)} km
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">cette période</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">MLS moyen</p>
            <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">{stats.avgMls}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">cette période</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
