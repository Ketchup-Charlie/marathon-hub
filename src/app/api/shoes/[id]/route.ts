import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const update: Record<string, unknown> = {}
  if ('brand'           in body) update.brand           = body.brand
  if ('model'           in body) update.model           = body.model
  if ('max_lifespan_km' in body) update.max_lifespan_km = body.max_lifespan_km
  if ('current_mileage' in body) update.current_mileage = body.current_mileage
  if ('active_status'   in body) update.active_status   = body.active_status

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shoes')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, brand, model, active_status, max_lifespan_km, current_mileage, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('shoes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return new Response(null, { status: 204 })
}
