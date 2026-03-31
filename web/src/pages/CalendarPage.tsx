import { useState, useEffect } from "react";
import { useCalendar } from "@/hooks/useCalendar";
import { useAuth } from "@/hooks/useAuth";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { Icon } from "@/components/ui/Icon";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { cn } from "@/lib/cn";

export function CalendarPage() {
  const { role } = useAuth();
  const isAthlete = role === "athlete";
  const {
    view,
    currentDate,
    selectedAthleteId,
    selectedSport,
    displayMode,
    days,
    athletes,
    isLoading,
    plannedAvailable,
    setView,
    setAthlete,
    setSport,
    setDisplayMode,
    navigateDate,
    goToToday,
  } = useCalendar({ skipAthleteList: isAthlete });

  // Fade transition on view/date change
  const [isTransitioning, setIsTransitioning] = useState(false);
  useEffect(() => {
    setIsTransitioning(true);
    const t = setTimeout(() => setIsTransitioning(false), 50);
    return () => clearTimeout(t);
  }, [view, currentDate]);

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Toolbar unifié */}
      <CalendarToolbar
        view={view}
        currentDate={currentDate}
        onViewChange={setView}
        onNavigate={navigateDate}
        onTodayClick={goToToday}
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        selectedSport={selectedSport}
        displayMode={displayMode}
        onAthleteChange={setAthlete}
        onSportChange={setSport}
        onDisplayModeChange={setDisplayMode}
        hideAthleteFilter={isAthlete}
      />

      {!plannedAvailable && (
        <FeatureNotice
          title="Séances planifiées indisponibles"
          description="La web app cible actuellement le projet Supabase `Project K`, où la table `planned_workouts` n'est pas exposée. Le calendrier affiche donc uniquement les séances réalisées."
          status="backend"
        />
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[320px] sm:min-h-[400px]">
          <Icon name="refresh" className="animate-spin text-4xl text-primary" />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col transition-opacity duration-200 ease-in-out",
            view === "week" && "max-h-[620px] overflow-y-auto",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
        >
          <CalendarGrid view={view} days={days} />
          <CalendarLegend />
        </div>
      )}

    </div>
  );
}
