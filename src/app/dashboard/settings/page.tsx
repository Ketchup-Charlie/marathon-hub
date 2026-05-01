import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const [{ data: raceConfig }, { data: blockRows }] = await Promise.all([
    supabase
      .from('race_config')
      .select('race_name, race_date, target_time, pace_mp, pace_tempo, pace_interval, pace_easy')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('blocks')
      .select('id, total_weeks')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const block = blockRows?.[0] ?? null

  return <SettingsClient raceConfig={raceConfig ?? null} block={block} />
}
