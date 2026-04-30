import { NextRequest } from 'next/server'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'

const PYTHON = process.env.PYTHON_PATH ?? 'python'
const PARSER = join(process.cwd(), 'parser', 'fit_parser.py')

function runParser(fitPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [PARSER, fitPath], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message))
        return
      }
      resolve(stdout)
    })
  })
}

export async function POST(request: NextRequest) {
  // Verify authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file field' }, { status: 400 })
  }

  if (!file.name.endsWith('.fit')) {
    return Response.json({ error: 'Only .fit files are accepted' }, { status: 400 })
  }

  const tmpPath = join(tmpdir(), `${randomUUID()}.fit`)

  try {
    const bytes = await file.arrayBuffer()
    await writeFile(tmpPath, Buffer.from(bytes))

    const stdout = await runParser(tmpPath)

    let parsed: unknown
    try {
      parsed = JSON.parse(stdout)
    } catch {
      return Response.json({ error: 'Parser returned invalid JSON', raw: stdout }, { status: 500 })
    }

    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return Response.json(parsed, { status: 422 })
    }

    return Response.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    unlink(tmpPath).catch(() => {})
  }
}
