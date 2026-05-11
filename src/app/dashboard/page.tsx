import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMetricsSummary, type MetricsSummary, type MomentumDay } from '@/lib/hermes'
import DashboardClient, {
  type DashboardBlock,
  type DashboardTodayWorkout,
  type DashboardTomorrowWorkout,
  type DashboardRecentRun,
} from './DashboardClient'

const AEST_TZ = 'Australia/Sydney'

function todayAEST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: AEST_TZ })
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStr    = todayAEST()
  const tomorrowStr = addDays(todayStr, 1)
  const cutoffStr   = addDays(todayStr, -83)

  let summary: MetricsSummary | null = null
  try { summary = await getMetricsSummary() } catch {}

  // Active block — block where today falls in [start_date, race_date], else most recent
  let block: DashboardBlock = null
  {
    const { data } = await supabase
      .from('blocks')
      .select('id, name, race_date, start_date')
      .eq('user_id', user.id)
      .lte('start_date', todayStr)
      .gte('race_date', todayStr)
      .maybeSingle()
    block = data ?? null
  }
  if (!block) {
    const { data } = await supabase
      .from('blocks')
      .select('id, name, race_date, start_date')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    block = data ?? null
  }

  const [
    todayWorkoutResult,
    tomorrowWorkoutResult,
    recentRunsResult,
    momentumRunsResult,
    momentumPlannedResult,
    raceConfigResult,
  ] = await Promise.all([
    block
      ? supabase
          .from('planned_workouts')
          .select('workout_type, target_distance_km, target_metric_type, target_metric_min, target_metric_max, description')
          .eq('block_id', block.id)
          .eq('date', todayStr)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    block
      ? supabase
          .from('planned_workouts')
          .select('workout_type, target_distance_km, description')
          .eq('block_id', block.id)
          .eq('date', tomorrowStr)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('completed_runs')
      .select('id, date, title, run_type_tag, total_distance, avg_pace, avg_hr, avg_gct, compliance_score')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('completed_runs')
      .select('date, compliance_score')
      .eq('user_id', user.id)
      .gte('date', cutoffStr)
      .lte('date', todayStr),
    block
      ? supabase
          .from('planned_workouts')
          .select('date')
          .eq('block_id', block.id)
          .gte('date', cutoffStr)
          .lte('date', todayStr)
          .not('workout_type', 'in', '("Rest","Strength")')
      : Promise.resolve({ data: null as { date: string }[] | null, error: null }),
    supabase
      .from('race_config')
      .select('race_date')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const raceDate = raceConfigResult.data?.race_date ?? block?.race_date ?? null

  const runDates      = new Set((momentumRunsResult.data  ?? []).map((r) => r.date))
  const complianceMap = new Map((momentumRunsResult.data  ?? []).map((r) => [r.date, r.compliance_score as string | null]))
  const plannedDates  = new Set((momentumPlannedResult.data ?? []).map((p) => p.date))

  const momentumDays: MomentumDay[] = Array.from({ length: 84 }, (_, i) => {
    const date  = addDays(todayStr, -i)
    const score = complianceMap.get(date) ?? null
    return {
      date,
      hasRun:     runDates.has(date),
      isAmber:    score === 'Yellow' || score === 'Red',
      hasPlanned: plannedDates.has(date),
    }
  })

  // Streak: consecutive run days going back from most recent run day
  let streak = 0
  const startIdx = runDates.has(todayStr) ? 0 : 1
  for (let i = startIdx; i < momentumDays.length; i++) {
    if (momentumDays[i].hasRun) streak++
    else break
  }

  // This-week stats (last 7 days including today)
  const weekStart     = addDays(todayStr, -6)
  const weekCompleted = (momentumRunsResult.data  ?? []).filter((r) => r.date >= weekStart).length
  const weekPlanned   = (momentumPlannedResult.data ?? []).filter((p) => p.date >= weekStart).length

  return (
    <DashboardClient
      summary={summary}
      block={block}
      raceDate={raceDate}
      todayStr={todayStr}
      todayWorkout={todayWorkoutResult.data as DashboardTodayWorkout}
      tomorrowWorkout={tomorrowWorkoutResult.data as DashboardTomorrowWorkout}
      todayCompleted={runDates.has(todayStr)}
      recentRuns={(recentRunsResult.data ?? []) as DashboardRecentRun[]}
      momentumDays={momentumDays}
      streak={streak}
      weekCompleted={weekCompleted}
      weekPlanned={weekPlanned}
    />
  )
}
