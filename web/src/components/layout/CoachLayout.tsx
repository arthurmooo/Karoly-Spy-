import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useStorageHealth } from "@/hooks/useStorageHealth";
import { useAvatarMapProvider, AvatarMapContext } from "@/hooks/useAvatarMap";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { Sidebar, getCoachNavItems, getAdminNavItems } from "./Sidebar";

export function CoachLayout() {
  const { signOut, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pct, status: storageStatus } = useStorageHealth();
  const avatarMap = useAvatarMapProvider();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navItems = getCoachNavItems(role);
  const adminItems = getAdminNavItems(role);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen bg-bg-light text-slate-800 dark:bg-bg-dark dark:text-slate-100 font-sans">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="coach-mobile-drawer"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-9 w-auto dark:brightness-90" />
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-xl p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            data-testid="coach-mobile-menu-close"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`${item.testId}-mobile`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <Icon name={item.icon} className="text-xl shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {adminItems.length > 0 && (
            <>
              <div className="my-3 mx-3 border-t border-slate-200/60 dark:border-slate-700/60" />
              <div className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Administration
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-testid={`${item.testId}-mobile`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                      isActive
                        ? "bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                        : "font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    )
                  }
                >
                  <Icon name={item.icon} className="text-xl shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-2 dark:border-slate-800">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
            data-testid="coach-theme-toggle-mobile"
          >
            <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-xl shrink-0" />
            {theme === "light" ? "Mode Sombre" : "Mode Clair"}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            aria-label="Déconnexion"
            data-testid="coach-signout-mobile"
          >
            <Icon name="logout" className="text-xl shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            data-testid="coach-mobile-menu-button"
          >
            <Icon name="menu" className="text-lg" />
            Menu
          </button>
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-8 w-auto dark:brightness-90" />
        </div>

        {storageStatus === "warning" && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 px-4 py-2.5 text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
            <Icon name="warning_amber" className="text-orange-500 shrink-0" />
            <span>Stockage FIT bientôt plein ({pct}%). Contactez votre administrateur.</span>
          </div>
        )}
        {storageStatus === "critical" && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
            <Icon name="error" className="text-red-500 shrink-0" />
            <span>Stockage FIT critique ({pct}%) ! Contactez votre administrateur immédiatement.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AvatarMapContext.Provider value={avatarMap}>
            <Outlet />
          </AvatarMapContext.Provider>
        </div>
      </main>
    </div>
  );
}
