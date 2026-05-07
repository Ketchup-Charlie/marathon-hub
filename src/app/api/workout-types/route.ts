import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id')
    .eq('user_id', user.id)

  const blockIds = (blocks ?? []).map((b: { id: string }) => b.id)
  if (blockIds.length === 0) return Response.json({ types: [] })

  const { data: workouts } = await supabase
    .from('planned_workouts')
    .select('workout_type')
    .in('block_id', blockIds)

  const types = [
    ...new Set(
      (workouts ?? [])
        .map((w: { workout_type: string }) => w.workout_type)
        .filter(Boolean)
    ),
  ].sort() as string[]

  return Response.json({ types })
}
