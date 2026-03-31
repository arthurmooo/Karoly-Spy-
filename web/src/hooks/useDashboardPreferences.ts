import { useCallback, useEffect, useState } from "react";

export type WidgetId =
  | "weekly-summary"
  | "last-session"
  | "next-planned"
  | "acwr"
  | "wellness"
  | "coach-feedback"
  | "sport-distribution";

export interface DashboardPreferences {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
}

export const ALL_WIDGETS: { id: WidgetId; label: string; icon: string }[] = [
  { id: "weekly-summary", label: "Résumé semaine", icon: "bar_chart" },
  { id: "last-session", label: "Dernière séance", icon: "history" },
  { id: "next-planned", label: "Prochaine séance", icon: "event" },
  { id: "acwr", label: "État de forme (ACWR)", icon: "monitor_heart" },
  { id: "wellness", label: "Bien-être", icon: "self_improvement" },
  { id: "coach-feedback", label: "Feedback coach", icon: "chat" },
  { id: "sport-distribution", label: "Répartition sports", icon: "donut_large" },
];

const DEFAULT_PREFS: DashboardPreferences = {
  widgetOrder: ALL_WIDGETS.map((w) => w.id),
  hiddenWidgets: [],
};

const STORAGE_KEY = "pk-dashboard-prefs";

function readPrefs(): DashboardPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as DashboardPreferences;
    if (!Array.isArray(parsed.widgetOrder)) return DEFAULT_PREFS;
    // Ensure all known widgets are present in the order list
    const known = new Set<WidgetId>(ALL_WIDGETS.map((w) => w.id));
    const order = parsed.widgetOrder.filter((id) => known.has(id));
    for (const w of ALL_WIDGETS) {
      if (!order.includes(w.id)) order.push(w.id);
    }
    return {
      widgetOrder: order,
      hiddenWidgets: Array.isArray(parsed.hiddenWidgets)
        ? parsed.hiddenWidgets.filter((id) => known.has(id))
        : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useDashboardPreferences() {
  const [prefs, setPrefs] = useState<DashboardPreferences>(readPrefs);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const visibleWidgets = prefs.widgetOrder.filter(
    (id) => !prefs.hiddenWidgets.includes(id)
  );

  const toggleWidget = useCallback((id: WidgetId) => {
    setPrefs((prev) => {
      const hidden = prev.hiddenWidgets.includes(id)
        ? prev.hiddenWidgets.filter((h) => h !== id)
        : [...prev.hiddenWidgets, id];
      return { ...prev, hiddenWidgets: hidden };
    });
  }, []);

  const moveWidget = useCallback((id: WidgetId, direction: "up" | "down") => {
    setPrefs((prev) => {
      const order = [...prev.widgetOrder];
      const idx = order.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= order.length) return prev;
      const tmp = order[idx]!;
      order[idx] = order[swapIdx]!;
      order[swapIdx] = tmp;
      return { ...prev, widgetOrder: order };
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, visibleWidgets, toggleWidget, moveWidget, resetDefaults };
}
