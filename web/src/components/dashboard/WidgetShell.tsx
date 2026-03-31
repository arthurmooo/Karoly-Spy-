import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface WidgetShellProps {
  title: string;
  icon: string;
  isLoading: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function WidgetShell({
  title,
  icon,
  isLoading,
  isEmpty,
  emptyMessage = "Aucune donnée",
  headerAction,
  className,
  children,
}: WidgetShellProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue/10">
            <Icon name={icon} className="text-sm text-accent-blue" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>
        {headerAction}
      </CardHeader>

      <CardContent className="flex-1 px-5 pb-5 pt-0">
        {isLoading ? (
          <div className="flex min-h-[100px] items-center justify-center">
            <Icon
              name="progress_activity"
              className="animate-spin text-2xl text-slate-400"
            />
          </div>
        ) : isEmpty ? (
          <div className="flex min-h-[100px] items-center justify-center">
            <p className="text-sm text-slate-400">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
