import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import {
  ALL_WIDGETS,
  type DashboardPreferences,
  type WidgetId,
} from "@/hooks/useDashboardPreferences";

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: DashboardPreferences;
  onToggle: (id: WidgetId) => void;
  onMove: (id: WidgetId, dir: "up" | "down") => void;
  onReset: () => void;
}

export function DashboardSettingsDialog({
  open,
  onClose,
  prefs,
  onToggle,
  onMove,
  onReset,
}: Props) {
  const widgetMeta = new Map(ALL_WIDGETS.map((w) => [w.id, w]));

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Personnaliser le dashboard
        </h2>
        <button
          onClick={onClose}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Icon name="close" className="text-xl" />
        </button>
      </DialogHeader>

      <DialogBody className="space-y-1">
        {prefs.widgetOrder.map((id, idx) => {
          const meta = widgetMeta.get(id);
          if (!meta) return null;
          const hidden = prefs.hiddenWidgets.includes(id);
          const isFirst = idx === 0;
          const isLast = idx === prefs.widgetOrder.length - 1;

          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              {/* Checkbox */}
              <button
                onClick={() => onToggle(id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 transition-colors dark:border-slate-600"
                style={
                  !hidden
                    ? { backgroundColor: "#2563eb", borderColor: "#2563eb" }
                    : undefined
                }
              >
                {!hidden && (
                  <Icon name="check" className="text-xs text-white" />
                )}
              </button>

              {/* Icon + label */}
              <div className="flex flex-1 items-center gap-2.5 min-w-0">
                <Icon
                  name={meta.icon}
                  className={`text-base ${hidden ? "text-slate-300 dark:text-slate-600" : "text-slate-600 dark:text-slate-400"}`}
                />
                <span
                  className={`text-sm font-medium ${hidden ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {meta.label}
                </span>
              </div>

              {/* Up / Down */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onMove(id, "up")}
                  disabled={isFirst}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                >
                  <Icon name="arrow_upward" className="text-sm" />
                </button>
                <button
                  onClick={() => onMove(id, "down")}
                  disabled={isLast}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                >
                  <Icon name="arrow_downward" className="text-sm" />
                </button>
              </div>
            </div>
          );
        })}
      </DialogBody>

      <DialogFooter>
        <button
          onClick={onReset}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Réinitialiser
        </button>
        <button
          onClick={onClose}
          className="rounded-xl bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Fermer
        </button>
      </DialogFooter>
    </Dialog>
  );
}
