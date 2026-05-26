import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMetricsSummary, getTrainingLoadTrend } from '@/lib/hermes'
import type { MetricsSummary, TrainingLoadPoint } from '@/lib/hermes'
import ActiveRickClient from './ActiveRickClient'

const AEST_TZ = 'Australia/Sydney'

function todayAEST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: AEST_TZ })
}

function calcBlockPhase(weekNum: number, totalWeeks: number): string {
  if (weekNum === totalWeeks)     return 'RACE'
  if (weekNum >= totalWeeks - 2)  return 'TAPER'
  if (weekNum >= totalWeeks - 4)  return 'PEAK'
  const remaining = totalWeeks - 5
  if (remaining <= 0) return 'BASE'
  const halfPoint = Math.ceil(remaining / 2)
  return weekNum <= halfPoint ? 'BASE' : 'BUILD'
}

function getWeekBounds(dateStr: string): { weekStart: string; weekEnd: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - daysFromMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export type ActiveRickRecentRun = {
  date: string
  title: string | null
  total_distance: number | null
  avg_pace: string | null
  avg_hr: number | null
  avg_gct: number | null
  avg_cadence: number | null
  compliance_score: string | null
}

export type ActiveRickPlannedWorkout = {
  date: string
  workout_type: string
  target_distance_km: number | null
  description: string | null
}

export type ActiveRickRaceConfig = {
  race_name: string | null
  race_date: string | null
  target_time: string | null
} | null

export type ActiveRickBlock = {
  id: string
  start_date: string
  race_date: string
  total_weeks: number
  phase: string | null
} | null

export default async function ActiveRickPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStr = todayAEST()
  const { weekStart, weekEnd } = getWeekBounds(todayStr)

  let block: ActiveRickBlock = null
  {
    const { data } = await supabase
      .from('blocks')
      .select('id, start_date, race_date, total_weeks')
      .eq('user_id', user.id)
      .lte('start_date', todayStr)
      .gte('race_date', todayStr)
      .maybeSingle()
    if (data) {
      const start = new Date(data.start_date + 'T00:00:00')
      const today = new Date(todayStr + 'T00:00:00')
      const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
      const weekNum = Math.max(1, Math.min(Math.ceil(daysSinceStart / 7) || 1, data.total_weeks))
      block = { ...data, phase: calcBlockPhase(weekNum, data.total_weeks) }
    }
  }

  const [summaryResult, trainingLoadResult] = await Promise.allSettled([
    getMetricsSummary(),
    getTrainingLoadTrend(),
  ])

  const summary: MetricsSummary | null = summaryResult.status === 'fulfilled' ? summaryResult.value : null
  const trainingLoad: TrainingLoadPoint[] = trainingLoadResult.status === 'fulfilled' ? trainingLoadResult.value : []

  const [recentRuns, plannedWorkouts, raceConfigRow] = await Promise.all([
    supabase
      .from('completed_runs')
      .select('date, title, total_distance, avg_pace, avg_hr, avg_gct, avg_cadence, compliance_score')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(5)
      .then(r => (r.data ?? []) as ActiveRickRecentRun[]),
    block
      ? supabase
          .from('planned_workouts')
          .select('date, workout_type, target_distance_km, description')
          .eq('block_id', block.id)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date')
          .then(r => (r.data ?? []) as ActiveRickPlannedWorkout[])
      : Promise.resolve([] as ActiveRickPlannedWorkout[]),
    supabase
      .from('race_config')
      .select('race_name, race_date, target_time')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(r => r.data),
  ])

  const raceConfig: ActiveRickRaceConfig = raceConfigRow ?? null

  return (
    <ActiveRickClient
      summary={summary}
      trainingLoad={trainingLoad}
      recentRuns={recentRuns}
      plannedWorkouts={plannedWorkouts}
      raceConfig={raceConfig}
      todayStr={todayStr}
      block={block}
    />
  )
}
