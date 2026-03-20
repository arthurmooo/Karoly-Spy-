import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { getSportConfig } from "@/lib/constants";
import {
  SPORT_OPTIONS,
  WORK_TYPE_OPTIONS,
  DURATION_OPTIONS,
} from "@/services/filter.service";
import type { Athlete } from "@/types/athlete";

interface SessionFiltersProps {
  sportType: string;
  workType: string;
  durationRange: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  onSportChange: (v: string | null) => void;
  onWorkTypeChange: (v: string | null) => void;
  onDurationChange: (v: string | null) => void;
  onDateFromChange: (v: string | null) => void;
  onDateToChange: (v: string | null) => void;
  onSearchChange: (v: string | null) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  /** Coach-only: athlete filter select */
  athleteId?: string;
  athletes?: Athlete[];
  onAthleteChange?: (v: string | null) => void;
}

export function SessionFilters({
  sportType,
  workType,
  durationRange,
  dateFrom,
  dateTo,
  search,
  onSportChange,
  onWorkTypeChange,
  onDurationChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onReset,
  hasActiveFilters,
  athleteId,
  athletes,
  onAthleteChange,
}: SessionFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const showAthlete = athletes != null && onAthleteChange != null;

  // Count active secondary filters (duration no longer counts — it's in chips now)
  const secondaryCount =
    (athleteId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const DURATION_LABELS: Record<string, string> = {
    "0-30": "< 30'",
    "30-60": "30'\u20131h",
    "60-120": "1\u20132h",
    "120-180": "2\u20133h",
    "180-": "> 3h",
  };

  // Active filter pills data
  const activePills: { label: string; onClear: () => void }[] = [];
  if (athleteId && athletes) {
    const ath = athletes.find((a) => a.id === athleteId);
    if (ath) activePills.push({ label: `${ath.first_name} ${ath.last_name}`, onClear: () => onAthleteChange?.(null) });
  }
  if (dateFrom) activePills.push({ label: `Depuis ${dateFrom}`, onClear: () => onDateFromChange(null) });
  if (dateTo) activePills.push({ label: `Jusqu'au ${dateTo}`, onClear: () => onDateToChange(null) });

  return (
    <div className="space-y-3">
      {/* Layer 1: Spotlight search */}
      <div className="relative group">
        <Icon
          name="search"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400 group-focus-within:text-primary transition-colors duration-200"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value || null)}
          placeholder="Rechercher une séance, un athlète..."
          className="w-full bg-slate-100/80 dark:bg-slate-800/60 border-0 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="close" className="text-base text-slate-400" />
          </button>
        )}
      </div>

      {/* Layer 2: Sport + Work type chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Sport chips — icon-only */}
        <ChipButton
          active={!sportType}
          onClick={() => onSportChange(null)}
          className="w-9 h-9 p-0 justify-center"
          title="Tous les sports"
        >
          <Icon name="select_all" className={cn("text-lg", !sportType ? "text-primary" : "text-slate-400")} />
        </ChipButton>
        {SPORT_OPTIONS.map((opt) => {
          const cfg = getSportConfig(opt.label);
          const isActive = sportType === opt.value;
          return (
            <ChipButton
              key={opt.value}
              active={isActive}
              activeClassName={`${cfg.bgLight} ${cfg.textColor} ${cfg.border}/30`}
              onClick={() => onSportChange(isActive ? null : opt.value)}
              className="w-9 h-9 p-0 justify-center"
              title={opt.label}
            >
              <Icon name={cfg.icon} className={cn("text-lg", isActive ? cfg.textColor : "text-slate-400")} />
            </ChipButton>
          );
        })}

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />

        {/* Work type chips */}
        <ChipButton
          active={!workType}
          onClick={() => onWorkTypeChange(null)}
        >
          Tous
        </ChipButton>
        {WORK_TYPE_OPTIONS.map((opt) => {
          const isActive = workType === opt.value;
          return (
            <ChipButton
              key={opt.value}
              active={isActive}
              onClick={() => onWorkTypeChange(isActive ? null : opt.value)}
            >
              {opt.label}
            </ChipButton>
          );
        })}

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />

        {/* Duration chips */}
        <ChipButton
          active={!durationRange}
          onClick={() => onDurationChange(null)}
        >
          Tous
        </ChipButton>
        {DURATION_OPTIONS.map((opt) => {
          const isActive = durationRange === opt.value;
          return (
            <ChipButton
              key={opt.value}
              active={isActive}
              onClick={() => onDurationChange(isActive ? null : opt.value)}
            >
              {DURATION_LABELS[opt.value] ?? opt.label}
            </ChipButton>
          );
        })}

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />

        {/* More filters toggle — icon-only */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          title="Filtres avancés"
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium border shrink-0 transition-all duration-200 relative",
            showMore
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          )}
        >
          <Icon name="tune" className="text-lg" />
          {secondaryCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold">
              {secondaryCount}
            </span>
          )}
        </button>
      </div>

      {/* Layer 3: Secondary filters (collapsible) */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          showMore ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-3 pt-1 pb-2">
            {showAthlete && (
              <div className="relative">
                <select
                  value={athleteId ?? ""}
                  onChange={(e) => onAthleteChange(e.target.value || null)}
                  className="appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="">Tous les athlètes</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 pointer-events-none" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value || null)}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value || null)}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {activePills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activePills.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              {pill.label}
              <button
                type="button"
                onClick={pill.onClear}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Icon name="close" className="text-sm" />
              </button>
            </span>
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Tout effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Chip Button ─── */

function ChipButton({
  active,
  activeClassName,
  onClick,
  children,
  className,
  title,
}: {
  active: boolean;
  activeClassName?: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border whitespace-nowrap shrink-0 transition-all duration-150",
        active
          ? activeClassName ?? "bg-primary/10 text-primary border-primary/30"
          : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
        className,
      )}
    >
      {children}
    </button>
  );
}
