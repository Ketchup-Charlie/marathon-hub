import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RunAnalysisClient from '../RunAnalysisClient'

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ run_id: string }>
}) {
  const { run_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/dashboard/run-analysis')

  const [runResult, lapsResult, tsResult] = await Promise.all([
    supabase
      .from('completed_runs')
      .select('id, date, title, run_type_tag, total_distance, total_time, avg_pace, avg_hr, max_hr, avg_cadence, avg_gct, avg_vertical_oscillation, notes')
      .eq('id', run_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('run_laps')
      .select('lap_number, lap_intent, distance, time, avg_pace, avg_hr, max_hr, avg_cadence, avg_gct, avg_stride_length, avg_vertical_oscillation')
      .eq('run_id', run_id)
      .order('lap_number'),
    supabase
      .from('run_timeseries')
      .select('seconds_elapsed, distance_km, pace_sec_per_km, hr, cadence, elevation_m')
      .eq('run_id', run_id)
      .order('seconds_elapsed'),
  ])

  if (runResult.error) console.error('[run-detail]', runResult.error.message)
  if (!runResult.data) redirect('/dashboard/run-analysis')

  return (
    <RunAnalysisClient
      run={runResult.data}
      laps={lapsResult.data ?? []}
      timeseries={tsResult.data ?? []}
    />
  )
}
