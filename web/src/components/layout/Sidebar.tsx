import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export const COACH_NAV_ITEMS = [
  { path: "/dashboard", label: "Tableau de bord", icon: "dashboard", testId: "coach-nav-dashboard" },
  { path: "/athletes", label: "Athlètes", icon: "groups", testId: "coach-nav-athletes" },
  { path: "/profiles", label: "Profils physio", icon: "cardiology", testId: "coach-nav-profiles" },
  { path: "/activities", label: "Séances", icon: "exercise", testId: "coach-nav-activities" },
  { path: "/calendar", label: "Calendrier", icon: "calendar_month", testId: "coach-nav-calendar" },
  { path: "/health", label: "Analytique", icon: "monitoring", testId: "coach-nav-health" },
];

export function Sidebar() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 h-screen sticky top-0 flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center gap-3 border-b border-slate-200 dark:border-slate-800", collapsed ? "justify-center p-3" : "px-5 py-4")}>
        {collapsed ? (
          <img src="/ks-logo.png" alt="KS" className="h-7 w-auto dark:brightness-90" />
        ) : (
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-10 w-auto dark:brightness-90" />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {COACH_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            data-testid={item.testId}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm"
                  : "font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )
            }
          >
            <Icon name={item.icon} className="text-xl shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === "light" ? "Mode Sombre" : "Mode Clair") : undefined}
          aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
          data-testid="coach-theme-toggle"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150",
            collapsed && "justify-center px-2"
          )}
        >
          <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-xl shrink-0" />
          {!collapsed && (theme === "light" ? "Mode Sombre" : "Mode Clair")}
        </button>
        <button
          onClick={() => signOut()}
          title={collapsed ? "Déconnexion" : undefined}
          aria-label="Déconnexion"
          data-testid="coach-signout"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150",
            collapsed && "justify-center px-2"
          )}
        >
          <Icon name="logout" className="text-xl shrink-0" />
          {!collapsed && "Déconnexion"}
        </button>
        {/* Toggle collapse */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Agrandir" : "Réduire"}
          aria-label={collapsed ? "Agrandir la navigation" : "Réduire la navigation"}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150",
            collapsed && "justify-center px-2"
          )}
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-xl shrink-0" />
          {!collapsed && "Réduire"}
        </button>
      </div>
    </aside>
  );
}
