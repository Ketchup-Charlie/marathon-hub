import { createClient } from '@/lib/supabase/server'
import BlockViewClient from './BlockViewClient'

export default async function BlockViewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, name, race_date, start_date, total_weeks, week_phases')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const block = blocks?.[0] ?? null

  if (!block) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NO_ACTIVE_BLOCK</span>
      </div>
    )
  }

  const { data: workouts } = await supabase
    .from('planned_workouts')
    .select('id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max, schedule_status')
    .eq('block_id', block.id)
    .order('date')

  return (
    <BlockViewClient
      block={{ ...block, week_phases: (block.week_phases as Record<string, string>) ?? {} }}
      workouts={workouts ?? []}
    />
  )
}
