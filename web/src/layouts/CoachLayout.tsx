import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthProvider'
import Sidebar from '@/components/sidebar'
import MobileNav from '@/components/mobile-nav'
import { Icon } from '@/components/ui/icon'
import { useState } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Vue d\'ensemble',
  '/profiles': 'Athlètes',
  '/activities': 'Séances',
  '/health': 'Analytique',
  '/calendar': 'Calendrier',
}

export default function CoachLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [search, setSearch] = useState('')

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] ?? 'Vue d\'ensemble'

  return (
    <div className="flex h-screen bg-slate-50/50 dark:bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar userEmail={user?.email ?? ''} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-[var(--border)] bg-white/80 dark:bg-[var(--card)]/80 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">/</span>
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none text-[var(--foreground)]"
                placeholder="Rechercher un athlète..."
                type="text"
              />
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
              <Icon name="notifications" size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--accent)] rounded-full border-2 border-white dark:border-[var(--card)]"></span>
            </button>
            <button className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
              <Icon name="add" size={18} />
              <span className="hidden sm:inline">Nouvelle séance</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
