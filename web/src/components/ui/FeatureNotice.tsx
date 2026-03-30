import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type FeatureStatus = "operational" | "partial" | "unavailable" | "backend";

interface FeatureNoticeProps {
  title: string;
  description: string;
  status?: FeatureStatus;
  className?: string;
}

const STATUS_CONFIG: Record<FeatureStatus, { badge: string; variant: "emerald" | "amber" | "red" | "slate" }> = {
  operational: { badge: "Branché", variant: "emerald" },
  partial: { badge: "Partiel", variant: "amber" },
  unavailable: { badge: "Non branché", variant: "red" },
  backend: { badge: "Dépendance back", variant: "slate" },
};

export function FeatureNotice({
  title,
  description,
  status = "unavailable",
  className,
}: FeatureNoticeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <Badge variant={config.variant}>{config.badge}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
