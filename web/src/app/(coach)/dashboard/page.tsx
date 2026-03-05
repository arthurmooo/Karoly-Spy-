import { getAthletes } from '@/repositories/athletes'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const athletes = await getAthletes()

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {athletes.length} athlete{athletes.length !== 1 && 's'} actif
        {athletes.length !== 1 && 's'}
      </p>
      <ul className="space-y-2">
        {athletes.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {a.first_name} {a.last_name}
            </span>
            {a.start_date && (
              <span className="ml-3 text-xs text-zinc-400">
                depuis {a.start_date}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
