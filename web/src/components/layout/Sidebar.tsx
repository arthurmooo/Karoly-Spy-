import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
  { path: "/profiles", label: "Athlètes", icon: "groups" },
  { path: "/activities", label: "Séances", icon: "exercise" },
  { path: "/calendar", label: "Calendrier", icon: "calendar_month" },
  { path: "/health", label: "Analytique", icon: "monitoring" },
];

export function Sidebar() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 w-10 h-10 rounded-sm shadow-sm flex items-center justify-center shrink-0">
          <Icon name="directions_run" filled className="text-white text-xl" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase text-slate-900 dark:text-white leading-tight">Project K</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Coach Portal</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors",
                isActive
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  : "font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )
            }
          >
            <Icon name={item.icon} className="text-xl" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-xl" />
          {theme === "light" ? "Mode Sombre" : "Mode Clair"}
        </button>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Icon name="logout" className="text-xl" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
