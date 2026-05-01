import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, total_weeks } = await req.json()

  const { data, error } = await supabase
    .from('blocks')
    .update({ total_weeks })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, total_weeks')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
