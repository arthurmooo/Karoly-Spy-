import { getAthletes } from '@/services/athletes'
import { getProfiles } from '@/services/physio'
import AthleteSelector from '@/components/physio/athlete-selector'
import PhysioHistory from '@/components/physio/physio-history'
import PhysioForm from '@/components/physio/physio-form'
import type { PhysioProfile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>
}) {
  const params = await searchParams
  const athleteId = params.athlete || null

  const athletes = await getAthletes()

  let profiles: PhysioProfile[] = []
  if (athleteId) {
    profiles = await getProfiles(athleteId)
  }

  const bikeProfiles = profiles.filter((p) => p.sport.toLowerCase() === 'bike')
  const runProfiles = profiles.filter((p) => p.sport.toLowerCase() === 'run')

  const hasActiveBike = bikeProfiles.some((p) => p.valid_to === null)
  const hasActiveRun = runProfiles.some((p) => p.valid_to === null)
  const showForm = athleteId && (!hasActiveBike || !hasActiveRun)

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
        Profils Physio
      </h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Historique des seuils physiologiques par athlete
      </p>

      <AthleteSelector athletes={athletes} />

      {!athleteId ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Selectionnez un athlete pour afficher ses profils.
        </p>
      ) : (
        <div className="space-y-6">
          <PhysioHistory sport="bike" profiles={bikeProfiles} athleteId={athleteId} />
          <PhysioHistory sport="run" profiles={runProfiles} athleteId={athleteId} />
          {showForm && <PhysioForm athleteId={athleteId} />}
        </div>
      )}
    </>
  )
}
