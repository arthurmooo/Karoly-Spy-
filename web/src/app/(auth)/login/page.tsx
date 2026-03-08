'use client'

import { useActionState } from 'react'
import { login } from './actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null)

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--background)] px-4">
      <div className="mt-[20vh] w-full max-w-sm rounded-[var(--radius-xl)] bg-[var(--card)] p-8 shadow-[var(--shadow-elevated)]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)] text-lg font-bold text-white">
            K
          </div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Project K</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Performance Hub
          </p>
        </div>

        <h2 className="mb-1 text-xl font-bold text-[var(--foreground)]">
          Connexion
        </h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">
          Accedez a votre tableau de bord
        </p>

        <form action={formAction} className="space-y-4">
          <Input
            icon="mail"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="email@exemple.com"
          />
          <Input
            icon="lock"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Mot de passe"
          />

          {state?.error && (
            <p className="rounded-[var(--radius)] bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="accent"
            disabled={pending}
            className="mt-2 w-full"
          >
            {pending ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <div className="mt-6 flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>Mot de passe oublie?</span>
          <a
            href="mailto:contact@karolyspy.com"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Demander un acces
          </a>
        </div>
      </div>
    </div>
  )
}
