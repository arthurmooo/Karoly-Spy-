import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Athlètes', href: '/profiles', icon: 'groups' },
  { label: 'Séances', href: '/activities', icon: 'exercise' },
  { label: 'Analytique', href: '/health', icon: 'monitoring' },
]

export default function MobileNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-[var(--card)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              active
                ? 'text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
