import { Icon } from "@/components/ui/Icon";

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mt-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-accent-orange/10 border border-accent-orange flex items-center justify-center">
          <Icon name="directions_run" className="text-[8px] text-accent-orange" />
        </div>
        <span>Course à pied</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-accent-blue/10 border border-accent-blue flex items-center justify-center">
          <Icon name="directions_bike" className="text-[8px] text-accent-blue" />
        </div>
        <span>Vélo</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-teal-500/10 border border-teal-500 flex items-center justify-center">
          <Icon name="pool" className="text-[8px] text-teal-600" />
        </div>
        <span>Natation</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-violet-500/10 border border-violet-500 flex items-center justify-center">
          <Icon name="downhill_skiing" className="text-[8px] text-violet-600" />
        </div>
        <span>Ski</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-400 flex items-center justify-center">
          <Icon name="fitness_center" className="text-[8px] text-slate-600" />
        </div>
        <span>Musculation</span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800/30 border border-dashed border-slate-400" />
        <span className="italic">Planifié (non réalisé)</span>
      </div>
    </div>
  );
}
