import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import MobileNav from '@/components/mobile-nav'

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto px-6 py-8 pb-20 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
