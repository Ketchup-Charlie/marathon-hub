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

  const body = await req.json() as { title?: string | null; run_type_tag?: string | null }
  const update: Record<string, unknown> = {}
  if ('title' in body) update.title = body.title
  if ('run_type_tag' in body) update.run_type_tag = body.run_type_tag

  const { error } = await supabase
    .from('completed_runs')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: run } = await supabase
    .from('completed_runs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!run) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const { error } = await supabase
    .from('completed_runs')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
