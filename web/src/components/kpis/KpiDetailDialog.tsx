import { Link } from "react-router-dom";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { getSportConfig } from "@/lib/constants";
import { getDecouplingBadgeVariant } from "@/lib/karolyMetrics";
import { getCardMeta } from "./KpiCards";
import type { KpiCard, SportDistributionItem, SportDecouplingItem } from "@/services/stats.service";

interface KpiDetailDialogProps {
  open: boolean;
  onClose: () => void;
  cardKey: KpiCard["key"] | null;
  cards: KpiCard[];
  distribution: SportDistributionItem[];
  sportDecoupling: SportDecouplingItem[];
  onSportSelect: (sportKey: string) => void;
  sessionsListPath?: string;
}

function getRpeColor(value: number): string {
  if (value < 5) return "text-emerald-600 dark:text-emerald-400";
  if (value <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function SportRow({
  sportKey,
  icon,
  label,
  children,
  onClick,
}: {
  sportKey: string;
  icon: string;
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const config = getSportConfig(sportKey);
  const isClickable = sportKey !== "AUTRES" && !!onClick;

  const content = (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 rounded-lg p-2 ${config.bgLight}`}>
          <Icon name={icon} className={`text-base ${config.textColor}`} />
        </div>
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );

  if (!isClickable) return content;

  return (
    <button
      className="w-full text-left transition-all duration-150 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:scale-[1.01] active:scale-[0.99]"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function ProgressBar({ percent, color = "bg-blue-500" }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className={`h-full rounded-full ${color} transition-all duration-300`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function KpiDetailDialog({
  open,
  onClose,
  cardKey,
  cards,
  distribution,
  sportDecoupling,
  onSportSelect,
  sessionsListPath,
}: KpiDetailDialogProps) {
  if (!cardKey) return null;

  const card = cards.find((c) => c.key === cardKey);
  if (!card) return null;

  const meta = getCardMeta(cardKey, card.value);

  const titleMap: Record<KpiCard["key"], string> = {
    distance: "Distance",
    hours: "Volume horaire",
    sessions: "Seances",
    rpe: "RPE moyen",
    decoupling: "Decouplage",
  };

  const totalDistanceKm = distribution.reduce((sum, item) => sum + item.distanceKm, 0);

  function handleSportClick(sportKey: string) {
    onSportSelect(sportKey);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${meta.iconBg} flex items-center justify-center`}>
            <Icon name={meta.icon} className={`text-sm ${meta.iconText}`} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {titleMap[cardKey]}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total : {card.displayValue}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          <Icon name="close" className="text-lg" />
        </button>
      </DialogHeader>

      <DialogBody>
        {cardKey === "distance" && (
          <DistanceContent
            distribution={distribution}
            totalDistanceKm={totalDistanceKm}
            onSportClick={handleSportClick}
          />
        )}
        {cardKey === "hours" && (
          <HoursContent distribution={distribution} onSportClick={handleSportClick} />
        )}
        {cardKey === "sessions" && (
          <SessionsContent
            distribution={distribution}
            onSportClick={handleSportClick}
            sessionsListPath={sessionsListPath}
          />
        )}
        {cardKey === "rpe" && (
          <RpeContent distribution={distribution} onSportClick={handleSportClick} />
        )}
        {cardKey === "decoupling" && (
          <DecouplingContent
            sportDecoupling={sportDecoupling}
            onSportClick={handleSportClick}
          />
        )}
      </DialogBody>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
      Aucune donnee disponible pour cette periode.
    </p>
  );
}

function DistanceContent({
  distribution,
  totalDistanceKm,
  onSportClick,
}: {
  distribution: SportDistributionItem[];
  totalDistanceKm: number;
  onSportClick: (key: string) => void;
}) {
  if (distribution.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {distribution.map((item) => {
        const config = getSportConfig(item.sportKey);
        const pct = totalDistanceKm > 0 ? (item.distanceKm / totalDistanceKm) * 100 : 0;
        return (
          <SportRow
            key={item.sportKey}
            sportKey={item.sportKey}
            icon={config.icon}
            label={item.label}
            onClick={() => onSportClick(item.sportKey)}
          >
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              {item.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
            </span>
            <ProgressBar percent={pct} color={config.bgColor} />
          </SportRow>
        );
      })}
    </div>
  );
}

function HoursContent({
  distribution,
  onSportClick,
}: {
  distribution: SportDistributionItem[];
  onSportClick: (key: string) => void;
}) {
  if (distribution.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {distribution.map((item) => {
        const config = getSportConfig(item.sportKey);
        return (
          <SportRow
            key={item.sportKey}
            sportKey={item.sportKey}
            icon={config.icon}
            label={item.label}
            onClick={() => onSportClick(item.sportKey)}
          >
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              {item.hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h
            </span>
            <Badge variant="slate">{item.percent.toFixed(0)} %</Badge>
            <ProgressBar percent={item.percent} color={config.bgColor} />
          </SportRow>
        );
      })}
    </div>
  );
}

function SessionsContent({
  distribution,
  onSportClick,
  sessionsListPath,
}: {
  distribution: SportDistributionItem[];
  onSportClick: (key: string) => void;
  sessionsListPath?: string;
}) {
  if (distribution.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {distribution.map((item) => {
        const config = getSportConfig(item.sportKey);
        return (
          <SportRow
            key={item.sportKey}
            sportKey={item.sportKey}
            icon={config.icon}
            label={item.label}
            onClick={() => onSportClick(item.sportKey)}
          >
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              {item.sessionCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              seance{item.sessionCount > 1 ? "s" : ""}
            </span>
          </SportRow>
        );
      })}

      {sessionsListPath && (
        <Link
          to={sessionsListPath}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800/50"
        >
          Voir toutes les seances
          <Icon name="arrow_forward" className="text-base" />
        </Link>
      )}
    </div>
  );
}

function RpeContent({
  distribution,
  onSportClick,
}: {
  distribution: SportDistributionItem[];
  onSportClick: (key: string) => void;
}) {
  const withRpe = distribution.filter((item) => item.avgRpe != null);
  if (withRpe.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {withRpe.map((item) => {
        const config = getSportConfig(item.sportKey);
        return (
          <SportRow
            key={item.sportKey}
            sportKey={item.sportKey}
            icon={config.icon}
            label={item.label}
            onClick={() => onSportClick(item.sportKey)}
          >
            <span className={`text-sm font-mono font-semibold ${getRpeColor(item.avgRpe!)}`}>
              {item.avgRpe!.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
            </span>
          </SportRow>
        );
      })}
    </div>
  );
}

function DecouplingContent({
  sportDecoupling,
  onSportClick,
}: {
  sportDecoupling: SportDecouplingItem[];
  onSportClick: (key: string) => void;
}) {
  if (sportDecoupling.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {sportDecoupling.map((item) => {
        const config = getSportConfig(item.sportKey);
        return (
          <SportRow
            key={item.sportKey}
            sportKey={item.sportKey}
            icon={config.icon}
            label={item.label}
            onClick={() => onSportClick(item.sportKey)}
          >
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {item.sessionCount} seance{item.sessionCount > 1 ? "s" : ""}
            </span>
            <Badge variant={getDecouplingBadgeVariant(item.avgDecoupling)}>
              {item.displayValue}
            </Badge>
          </SportRow>
        );
      })}
    </div>
  );
}
