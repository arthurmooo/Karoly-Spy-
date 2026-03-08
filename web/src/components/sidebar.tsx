'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { logout } from '@/app/(auth)/login/actions'
import { useTheme } from '@/components/theme-provider'
import { Icon } from '@/components/ui/icon'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Activites', href: '/activities', icon: 'cardiology' },
  { label: 'Sante', href: '/health', icon: 'favorite' },
  { label: 'Profils', href: '/profiles', icon: 'person' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

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

  const initials = userEmail
    .split('@')[0]
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] text-sm font-bold text-white">
          K
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight text-[var(--foreground)]">
              Project K
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Performance Hub
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-l-[3px] border-[var(--primary)] bg-[rgba(36,0,102,0.05)] text-[var(--primary)] dark:bg-[rgba(167,139,250,0.08)]'
                      : 'border-l-[3px] border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
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

      {/* Bottom: user + actions */}
      <div className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
              {initials}
            </div>
            <span className="truncate text-xs font-medium text-[var(--muted-foreground)]" title={userEmail}>
              {userEmail}
            </span>
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[var(--radius)] py-2 px-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Icon name="logout" size={20} />
            {!collapsed && <span className="text-sm font-medium">Deconnexion</span>}
          </button>
        </form>
        <div className={`mt-1 flex items-center ${collapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-[var(--radius)] py-2 px-1 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
            {!collapsed && (
              <span className="text-sm font-medium">
                {theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
              </span>
            )}
          </button>
          <button
            onClick={toggleCollapse}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-label={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
          >
            <Icon
              name="chevron_left"
              size={20}
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
    </aside>
  )
}
