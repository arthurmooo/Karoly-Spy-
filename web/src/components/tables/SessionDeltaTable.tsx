import { cn } from "@/lib/cn";
import type { ComparisonSummary } from "@/types/activity";

interface Props {
  summary: ComparisonSummary;
}

export function SessionDeltaTable({ summary }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
            <th className="px-4 py-3">Métrique</th>
            <th className="px-4 py-3">Courante</th>
            <th className="px-4 py-3">Référence</th>
            <th className="px-4 py-3">Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {summary.rows.map((row) => (
            <tr key={row.key} className="text-sm text-slate-700 dark:text-slate-300">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.label}</td>
              <td className="px-4 py-3 font-mono">{row.currentValue}</td>
              <td className="px-4 py-3 font-mono">{row.referenceValue}</td>
              <td
                className={cn("px-4 py-3 font-mono font-semibold", {
                  "text-emerald-600 dark:text-emerald-400": row.trend === "positive",
                  "text-red-600 dark:text-red-400": row.trend === "negative",
                  "text-slate-500 dark:text-slate-400": row.trend === "neutral",
                })}
              >
                {row.deltaValue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
