import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getMetricsSummary,
  getReadinessTrend,
  getSleepTrend,
  type MetricsSummary,
  type ReadinessTrendPoint,
  type SleepTrendPoint,
} from '@/lib/hermes'
import RecoveryScoreClient, { type TomorrowWorkout } from './RecoveryScoreClient'

export default async function RecoveryScorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStr    = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const tomorrowDay = new Date(todayStr)
  tomorrowDay.setDate(tomorrowDay.getDate() + 1)
  const tomorrowStr = tomorrowDay.toLocaleDateString('en-CA')

  let summary:         MetricsSummary | null   = null
  let readinessTrend:  ReadinessTrendPoint[]   = []
  let sleepTrend:      SleepTrendPoint[]       = []
  let tomorrowWorkout: TomorrowWorkout         = null

  try { summary        = await getMetricsSummary()  } catch (e) { console.error('[recovery-score] summary:', e)   }
  try { readinessTrend = await getReadinessTrend()   } catch (e) { console.error('[recovery-score] readiness:', e) }
  try { sleepTrend     = await getSleepTrend()       } catch (e) { console.error('[recovery-score] sleep:', e)    }

  try {
    const { data: block } = await supabase
      .from('blocks')
      .select('id')
      .eq('user_id', user.id)
      .lte('start_date', todayStr)
      .gte('race_date', todayStr)
      .maybeSingle()

    if (block) {
      const { data: workout } = await supabase
        .from('planned_workouts')
        .select('workout_type, target_distance_km, description')
        .eq('block_id', block.id)
        .eq('date', tomorrowStr)
        .maybeSingle()
      tomorrowWorkout = workout ?? null
    }
  } catch (e) { console.error('[recovery-score] tomorrow workout:', e) }

  const dedupedReadiness = (() => {
    const byDate = new Map<string, typeof readinessTrend[number]>()
    for (const r of readinessTrend) {
      const existing = byDate.get(r.date)
      if (!existing || (r.readiness_score ?? 0) > (existing.readiness_score ?? 0)) {
        byDate.set(r.date, r)
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  })()

  return (
    <RecoveryScoreClient
      summary={summary}
      readinessTrend={dedupedReadiness}
      sleepTrend={sleepTrend}
      tomorrowWorkout={tomorrowWorkout}
    />
  )
}
