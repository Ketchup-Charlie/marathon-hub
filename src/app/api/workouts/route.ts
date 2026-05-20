import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    block_id, date, workout_type, description,
    target_distance_km, target_metric_type, target_metric_min, target_metric_max,
    secondary_type, secondary_description,
  } = body

  const { data, error } = await supabase
    .from('planned_workouts')
    .insert({
      block_id, date, workout_type,
      description: description ?? null,
      target_distance_km: target_distance_km ?? null,
      target_metric_type: target_metric_type ?? null,
      target_metric_min: target_metric_min ?? null,
      target_metric_max: target_metric_max ?? null,
      secondary_type: secondary_type ?? null,
      secondary_description: secondary_description ?? null,
    })
    .select('id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max, schedule_status, secondary_type, secondary_description')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    id, workout_type, description,
    target_distance_km, target_metric_type, target_metric_min, target_metric_max,
    secondary_type, secondary_description,
  } = body

  const { data, error } = await supabase
    .from('planned_workouts')
    .update({
      workout_type,
      description: description ?? null,
      target_distance_km: target_distance_km ?? null,
      target_metric_type: target_metric_type ?? null,
      target_metric_min: target_metric_min ?? null,
      target_metric_max: target_metric_max ?? null,
      secondary_type: secondary_type ?? null,
      secondary_description: secondary_description ?? null,
    })
    .eq('id', id)
    .select('id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max, schedule_status, secondary_type, secondary_description')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
