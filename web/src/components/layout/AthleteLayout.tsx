import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useMyAthleteProfile } from "@/hooks/useMyAthleteProfile";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

const ATHLETE_NAV = [
  { path: "/mon-espace", label: "Mon espace", icon: "home", testId: "athlete-nav-home" },
  { path: "/mon-espace/bilan", label: "Bilan", icon: "analytics", testId: "athlete-nav-report" },
  { path: "/mon-espace/seances", label: "Mes séances", icon: "fitness_center", testId: "athlete-nav-sessions" },
  { path: "/mon-espace/calendrier", label: "Calendrier", icon: "calendar_month", testId: "athlete-nav-calendar" },
];

export function AthleteLayout() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useMyAthleteProfile();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen bg-bg-light text-slate-800 dark:bg-bg-dark dark:text-slate-100 font-sans">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-10 w-auto dark:brightness-90" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {ATHLETE_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/mon-espace"}
              data-testid={item.testId}
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
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-2 dark:border-slate-800">
          {profile && (
            <NavLink
              to="/mon-espace/profil"
              data-testid="athlete-nav-profile"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <AthleteAvatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                avatarUrl={profile.avatar_url}
                size="sm"
                shape="circle"
              />
              <span className="truncate">{profile.first_name} {profile.last_name.charAt(0)}.</span>
            </NavLink>
          )}
          <button
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
            data-testid="athlete-theme-toggle"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-xl shrink-0" />
            {theme === "light" ? "Mode Sombre" : "Mode Clair"}
          </button>
          <button
            onClick={() => signOut()}
            aria-label="Déconnexion"
            data-testid="athlete-signout"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Icon name="logout" className="text-xl shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

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
        data-testid="athlete-mobile-drawer"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-9 w-auto dark:brightness-90" />
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-xl p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            data-testid="athlete-mobile-menu-close"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {ATHLETE_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/mon-espace"}
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
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-2 dark:border-slate-800">
          {profile && (
            <NavLink
              to="/mon-espace/profil"
              data-testid="athlete-nav-profile-mobile"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-slate-100 font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <AthleteAvatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                avatarUrl={profile.avatar_url}
                size="sm"
                shape="circle"
              />
              <span className="truncate">{profile.first_name} {profile.last_name.charAt(0)}.</span>
            </NavLink>
          )}
          <button
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
            data-testid="athlete-theme-toggle-mobile"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-xl shrink-0" />
            {theme === "light" ? "Mode Sombre" : "Mode Clair"}
          </button>
          <button
            onClick={() => signOut()}
            aria-label="Déconnexion"
            data-testid="athlete-signout-mobile"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
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
            data-testid="athlete-mobile-menu-button"
          >
            <Icon name="menu" className="text-lg" />
            Menu
          </button>
          <img src="/ks-logo.png" alt="KS Endurance Training" className="h-8 w-auto dark:brightness-90" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
