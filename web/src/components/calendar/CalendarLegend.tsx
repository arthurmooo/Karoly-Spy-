import { Icon } from "@/components/ui/Icon";
import { SPORT_CONFIG } from "@/lib/constants";

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mt-4">
      {SPORT_CONFIG.map(s => (
        <div key={s.key} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-sm ${s.bgLight} border ${s.border} flex items-center justify-center`}>
            <Icon name={s.icon} className={`text-[8px] ${s.textColor}`} />
          </div>
          <span>{s.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-auto">
        <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800/30 border border-dashed border-slate-400" />
        <span className="italic">Planifié (non réalisé)</span>
      </div>
    </div>
  );
}
