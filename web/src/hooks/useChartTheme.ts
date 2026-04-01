import { useTheme } from "./useTheme";

export function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return {
    grid: isDark ? "#334155" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#64748b",
    tooltipStyle: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      borderRadius: "8px",
      boxShadow: isDark
        ? "0 4px 6px -1px rgb(0 0 0 / 0.3)"
        : "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      color: isDark ? "#f1f5f9" : "#1e293b",
      fontSize: "12px",
    },
    activeDotFill: isDark ? "#1e293b" : "#ffffff",
  };
}
