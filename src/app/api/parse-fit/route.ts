import { NextRequest } from 'next/server'
import { execFile } from 'child_process'
import { renameSync } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import { createClient } from '@/lib/supabase/server'

const PYTHON = process.env.PYTHON_PATH ?? 'python3'
const PARSER = join(process.cwd(), 'parser', 'fit_parser.py')

function extractFitFromZip(zipPath: string, fitPath: string): void {
  const zip = new AdmZip(zipPath)
  const fitEntry = zip.getEntries().find(e => e.entryName.endsWith('.fit'))
  if (!fitEntry) throw new Error('No .fit file found inside zip')
  zip.extractEntryTo(fitEntry, dirname(fitPath), false, true)
  const extracted = join(dirname(fitPath), fitEntry.name)
  if (extracted !== fitPath) renameSync(extracted, fitPath)
}

class ParserError extends Error {
  constructor(public readonly stderr: string, message: string) {
    super(message)
  }
}

function runParser(fitPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [PARSER, fitPath], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new ParserError(stderr, err.message))
        return
      }
      if (!stdout.trim()) {
        reject(new ParserError(stderr, 'Parser produced no output'))
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

  const lowerName = file.name.toLowerCase()
  const isZip = lowerName.endsWith('.zip')
  const isFit = lowerName.endsWith('.fit')

  if (!isFit && !isZip) {
    return Response.json({ error: 'Only .fit and .zip files are accepted' }, { status: 400 })
  }

  const uploadPath = join(tmpdir(), `${randomUUID()}${isZip ? '.zip' : '.fit'}`)
  let fitPath: string | null = null

  try {
    const bytes = await file.arrayBuffer()
    await writeFile(uploadPath, Buffer.from(bytes))

    if (isZip) {
      fitPath = join(tmpdir(), `${randomUUID()}.fit`)
      extractFitFromZip(uploadPath, fitPath)
    } else {
      fitPath = uploadPath
    }

    const stdout = await runParser(fitPath)

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
    if (err instanceof ParserError) {
      return Response.json({ error: 'Parser failed', detail: (err.stderr || '') + (err.message || '') }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    unlink(uploadPath).catch(() => {})
    if (fitPath && fitPath !== uploadPath) unlink(fitPath).catch(() => {})
  }
}
