import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, total_weeks, week_phases } = await req.json()
  const update: Record<string, unknown> = {}
  if (total_weeks  !== undefined) update.total_weeks  = total_weeks
  if (week_phases  !== undefined) update.week_phases  = week_phases

  const { data, error } = await supabase
    .from('blocks')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, total_weeks, week_phases')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
