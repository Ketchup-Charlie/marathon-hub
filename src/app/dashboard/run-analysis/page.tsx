import { createClient } from '@/lib/supabase/server'
import RunLogClient from './RunLogClient'

export default async function RunAnalysisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const { data: runs } = await supabase
    .from('completed_runs')
    .select('id, date, title, run_type_tag, total_distance, total_time, avg_pace, avg_hr, avg_gct, avg_cadence, compliance_score')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  return <RunLogClient runs={runs ?? []} />
}
