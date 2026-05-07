import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('shoes')
    .select('id, brand, model, active_status, max_lifespan_km, current_mileage, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    brand: string
    model: string
    max_lifespan_km?: number | null
    current_mileage?: number
    active_status?: boolean
  }

  if (!body.brand?.trim() || !body.model?.trim()) {
    return Response.json({ error: 'brand and model are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shoes')
    .insert({
      user_id:          user.id,
      brand:            body.brand.trim(),
      model:            body.model.trim(),
      max_lifespan_km:  body.max_lifespan_km ?? null,
      current_mileage:  body.current_mileage ?? 0,
      active_status:    body.active_status ?? true,
    })
    .select('id, brand, model, active_status, max_lifespan_km, current_mileage, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
