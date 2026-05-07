import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'

const PYTHON = process.env.PYTHON_PATH ?? 'python'
const UPLOADER = join(process.cwd(), 'parser', 'upload.py')

function runUploader(
  jsonStr: string,
  userId: string,
  opts: { shoeId?: string | null; runTypeTag?: string | null; title?: string | null },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [UPLOADER, '--user-id', userId]
    if (opts.shoeId)     args.push('--shoe-id',       opts.shoeId)
    if (opts.runTypeTag) args.push('--run-type-tag',   opts.runTypeTag)
    if (opts.title)      args.push('--title',          opts.title)

    const proc = spawn(PYTHON, args)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `Exit code ${code}`))
      else resolve(stdout.trim())
    })
    proc.on('error', reject)
    proc.stdin.write(jsonStr)
    proc.stdin.end()
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    parsedRun: Record<string, unknown>
    title?: string | null
    run_type_tag?: string | null
    shoe_id?: string | null
    notes?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { parsedRun, title, run_type_tag, shoe_id, notes } = body
  if (!parsedRun || typeof parsedRun !== 'object') {
    return Response.json({ error: 'Missing parsedRun' }, { status: 400 })
  }

  let stdout: string
  try {
    stdout = await runUploader(JSON.stringify(parsedRun), user.id, {
      shoeId: shoe_id ?? null,
      runTypeTag: run_type_tag ?? null,
      title: title ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }

  let result: { success?: boolean; run_id?: string; error?: string }
  try {
    result = JSON.parse(stdout)
  } catch {
    return Response.json({ error: 'Uploader returned invalid JSON', raw: stdout }, { status: 500 })
  }

  if (result.error || !result.run_id) {
    return Response.json({ error: result.error ?? 'UPLOAD_FAILED' }, { status: 500 })
  }

  if (notes) {
    await supabase
      .from('completed_runs')
      .update({ notes })
      .eq('id', result.run_id)
  }

  if (shoe_id) {
    const { data: uploadedRun } = await supabase
      .from('completed_runs')
      .select('total_distance')
      .eq('id', result.run_id)
      .single()

    if (uploadedRun?.total_distance) {
      const { data: shoe } = await supabase
        .from('shoes')
        .select('current_mileage')
        .eq('id', shoe_id)
        .eq('user_id', user.id)
        .single()

      if (shoe) {
        await supabase
          .from('shoes')
          .update({ current_mileage: shoe.current_mileage + uploadedRun.total_distance })
          .eq('id', shoe_id)
          .eq('user_id', user.id)
      }
    }
  }

  return Response.json({ run_id: result.run_id })
}
