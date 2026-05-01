import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('race_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { race_name, race_date, target_time, pace_mp, pace_tempo, pace_interval, pace_easy, total_weeks } = body

  const { data, error } = await supabase
    .from('race_config')
    .upsert(
      {
        user_id: user.id,
        race_name: race_name ?? null,
        race_date: race_date ?? null,
        target_time,
        pace_mp: pace_mp ?? null,
        pace_tempo: pace_tempo ?? null,
        pace_interval: pace_interval ?? null,
        pace_easy: pace_easy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  const blockUpdate: Record<string, unknown> = {}
  if (race_date)              blockUpdate.race_date   = race_date
  if (total_weeks !== undefined) blockUpdate.total_weeks = total_weeks
  if (Object.keys(blockUpdate).length > 0) {
    await supabase.from('blocks').update(blockUpdate).eq('user_id', user.id)
  }

  return Response.json(data)
}
