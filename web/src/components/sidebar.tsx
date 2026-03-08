import { Link, useLocation } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import { useTheme } from '@/components/theme-provider'
import { Icon } from '@/components/ui/icon'

const NAV_ITEMS = [
  { label: 'Tableau de bord', href: '/dashboard', icon: 'dashboard' },
  { label: 'Athlètes', href: '/profiles', icon: 'groups' },
  { label: 'Séances', href: '/activities', icon: 'exercise' },
  { label: 'Calendrier', href: '/calendar', icon: 'calendar_month' },
  { label: 'Analytique', href: '/health', icon: 'monitoring' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const { signOut } = useAuth()

  const collapsed = useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb)
      return () => window.removeEventListener('storage', cb)
    },
    () => localStorage.getItem('sidebar-collapsed') === 'true',
    () => false,
  )

  function toggleCollapse() {
    const next = !collapsed
    localStorage.setItem('sidebar-collapsed', String(next))
    window.dispatchEvent(new StorageEvent('storage'))
  }

  const displayName = userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const initials = userEmail
    .split('@')[0]
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
          <Icon name="bolt" size={20} />
        </div>
        {!collapsed && (
          <h1 className="text-xl font-bold tracking-tight text-[var(--primary)]">Projet K</h1>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-100 text-[var(--primary)] dark:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon name={item.icon} size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border)] p-3">
        <button
          onClick={() => {}}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50 transition-colors cursor-pointer mb-3"
        >
          <Icon name="settings" size={20} />
          {!collapsed && <span className="text-sm font-medium">Paramètres</span>}
        </button>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{displayName}</p>
              <p className="truncate text-xs text-slate-500">Premium Plan</p>
            </div>
          )}
        </div>
        <div className={`mt-2 flex items-center ${collapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-lg py-2 px-1 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer"
            aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={18} />
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-lg py-2 px-1 text-[var(--muted-foreground)] hover:text-red-500 transition-colors cursor-pointer"
            aria-label="Déconnexion"
          >
            <Icon name="logout" size={18} />
          </button>
          <button
            onClick={toggleCollapse}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          >
            <Icon name="chevron_left" size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </aside>
  )
}
