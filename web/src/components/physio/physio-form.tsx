'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { paceToSpeed } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PhysioFormProps {
  athleteId: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function PhysioForm({ athleteId }: PhysioFormProps) {
  const router = useRouter()
  const [sport, setSport] = useState<'bike' | 'run'>('bike')
  const [validFrom, setValidFrom] = useState(today())
  const [lt1Hr, setLt1Hr] = useState('')
  const [lt2Hr, setLt2Hr] = useState('')
  const [lt1PowerPace, setLt1PowerPace] = useState('')
  const [lt2PowerPace, setLt2PowerPace] = useState('')
  const [cpCs, setCpCs] = useState('')
  const [weight, setWeight] = useState('')
  const [vma, setVma] = useState('')
  const [cpMontee, setCpMontee] = useState('')
  const [cpHt, setCpHt] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const isBike = sport === 'bike'

  const resetForm = () => {
    setLt1Hr('')
    setLt2Hr('')
    setLt1PowerPace('')
    setLt2PowerPace('')
    setCpCs('')
    setWeight('')
    setVma('')
    setCpMontee('')
    setCpHt('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setFeedback(null)

    const parseNum = (v: string) => (v === '' ? null : Number(v))

    const parsePowerPace = (v: string): number | null => {
      if (v === '') return null
      if (sport === 'run') {
        const speed = paceToSpeed(v)
        if (speed === null) {
          setFeedback({ type: 'error', msg: 'Format allure invalide (ex: 4:30)' })
          setLoading(false)
          return NaN
        }
        return speed
      }
      return Number(v)
    }

    const lt1pp = parsePowerPace(lt1PowerPace)
    if (lt1pp !== null && isNaN(lt1pp)) return
    const lt2pp = parsePowerPace(lt2PowerPace)
    if (lt2pp !== null && isNaN(lt2pp)) return
    const cpCsVal = parsePowerPace(cpCs)
    if (cpCsVal !== null && isNaN(cpCsVal)) return

    const body = {
      athlete_id: athleteId,
      sport,
      valid_from: validFrom,
      lt1_hr: parseNum(lt1Hr),
      lt2_hr: parseNum(lt2Hr),
      lt1_power_pace: lt1pp,
      lt2_power_pace: lt2pp,
      cp_cs: cpCsVal,
      weight: parseNum(weight),
      vma: isBike ? null : parseNum(vma),
      cp_montee: isBike ? parseNum(cpMontee) : null,
      cp_ht: isBike ? parseNum(cpHt) : null,
    }

    try {
      const res = await fetch('/api/physio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setFeedback({ type: 'error', msg: data.error || 'Erreur serveur' })
        return
      }
      setFeedback({ type: 'success', msg: 'Profil ajoute avec succes' })
      resetForm()
      router.refresh()
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur reseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
        Nouveau profil
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Select
            label="Sport"
            value={sport}
            onChange={(e) => {
              setSport(e.target.value as 'bike' | 'run')
              resetForm()
            }}
          >
            <option value="bike">Velo</option>
            <option value="run">Course a pied</option>
          </Select>
          <Input
            label="Date (valid_from)"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            required
          />
          <Input
            label="FC LT1 (BPM)"
            type="number"
            value={lt1Hr}
            onChange={(e) => setLt1Hr(e.target.value)}
            placeholder="145"
          />
          <Input
            label="FC LT2 (BPM)"
            type="number"
            value={lt2Hr}
            onChange={(e) => setLt2Hr(e.target.value)}
            placeholder="170"
          />
          <Input
            label={isBike ? 'Puiss. LT1 (W)' : 'Allure LT1 (M:SS)'}
            type={isBike ? 'number' : 'text'}
            value={lt1PowerPace}
            onChange={(e) => setLt1PowerPace(e.target.value)}
            placeholder={isBike ? '200' : '5:00'}
          />
          <Input
            label={isBike ? 'Puiss. LT2 (W)' : 'Allure LT2 (M:SS)'}
            type={isBike ? 'number' : 'text'}
            value={lt2PowerPace}
            onChange={(e) => setLt2PowerPace(e.target.value)}
            placeholder={isBike ? '260' : '4:15'}
          />
          <Input
            label={isBike ? 'CP (W)' : 'CS (M:SS)'}
            type={isBike ? 'number' : 'text'}
            value={cpCs}
            onChange={(e) => setCpCs(e.target.value)}
            placeholder={isBike ? '280' : '3:50'}
          />
          <Input
            label="Poids (kg)"
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="72"
          />
          {isBike ? (
            <>
              <Input
                label="CP Montee (W)"
                type="number"
                value={cpMontee}
                onChange={(e) => setCpMontee(e.target.value)}
                placeholder="270"
              />
              <Input
                label="CP HT (W)"
                type="number"
                value={cpHt}
                onChange={(e) => setCpHt(e.target.value)}
                placeholder="290"
              />
            </>
          ) : (
            <Input
              label="VMA (km/h)"
              type="number"
              step="0.1"
              value={vma}
              onChange={(e) => setVma(e.target.value)}
              placeholder="18.5"
            />
          )}
        </div>

        <div className="mt-2 flex items-center gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Ajouter le profil'}
          </Button>
          {feedback && (
            <span
              className={`text-sm font-medium ${
                feedback.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}
