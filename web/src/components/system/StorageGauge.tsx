import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useStorageHealth } from "@/hooks/useStorageHealth";

export function StorageGauge() {
  const { storage, isLoading, isStale, pct, status } = useStorageHealth();

  // Auto-hide when below 50% and not stale
  if (isLoading || (!storage && !isLoading)) return null;
  if (status === "ok" && pct < 50 && !isStale) return null;

  const valueGb = storage?.value_gb ?? 0;
  const limitGb = storage?.limit_gb ?? 100;

  const barColor =
    status === "critical"
      ? "bg-red-500"
      : status === "warning"
        ? "bg-orange-500"
        : "bg-emerald-500";

  const statusBadge = isStale ? (
    <Badge variant="orange">OBSOLÈTE</Badge>
  ) : status === "critical" ? (
    <Badge variant="red">CRITIQUE</Badge>
  ) : status === "warning" ? (
    <Badge variant="orange">ATTENTION</Badge>
  ) : (
    <Badge variant="slate">OK</Badge>
  );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Stockage FIT
            </p>
            <h3 className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
              {valueGb.toFixed(1)} <span className="text-sm font-normal text-slate-400">/ {limitGb} GB</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Icon name="cloud_upload" className="text-slate-400 text-sm" />
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          {pct}% utilisé
          {isStale && " · Données obsolètes (pipeline inactif > 24h)"}
        </p>
      </CardContent>
    </Card>
  );
}
