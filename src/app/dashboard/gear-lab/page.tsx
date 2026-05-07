import { createClient } from '@/lib/supabase/server'
import GearLabClient from './GearLabClient'

export default async function GearLabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0]

  const [shoesResult, runTagsResult, recentRunsResult] = await Promise.all([
    supabase
      .from('shoes')
      .select('id, brand, model, active_status, max_lifespan_km, current_mileage')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('completed_runs')
      .select('shoe_id, run_type_tag')
      .eq('user_id', user.id)
      .not('shoe_id', 'is', null)
      .not('run_type_tag', 'is', null),

    supabase
      .from('completed_runs')
      .select('shoe_id, total_distance')
      .eq('user_id', user.id)
      .not('shoe_id', 'is', null)
      .not('total_distance', 'is', null)
      .gte('date', cutoff),
  ])

  const runTagsByShoe: Record<string, string[]> = {}
  for (const r of runTagsResult.data ?? []) {
    if (!r.shoe_id || !r.run_type_tag) continue
    if (!runTagsByShoe[r.shoe_id]) runTagsByShoe[r.shoe_id] = []
    if (!runTagsByShoe[r.shoe_id].includes(r.run_type_tag))
      runTagsByShoe[r.shoe_id].push(r.run_type_tag)
  }

  const recentDistByShoe: Record<string, number> = {}
  for (const r of recentRunsResult.data ?? []) {
    if (!r.shoe_id || !r.total_distance) continue
    recentDistByShoe[r.shoe_id] = (recentDistByShoe[r.shoe_id] ?? 0) + r.total_distance
  }

  return (
    <GearLabClient
      shoes={shoesResult.data ?? []}
      runTagsByShoe={runTagsByShoe}
      recentDistByShoe={recentDistByShoe}
    />
  )
}
