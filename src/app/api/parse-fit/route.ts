import { NextRequest } from 'next/server'
import { execFile } from 'child_process'
import { existsSync, renameSync, statSync, openSync, readSync, closeSync } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import { createClient } from '@/lib/supabase/server'

function resolvePython(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH
  for (const p of [
    '/opt/render/project/src/parser/venv/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ]) {
    if (existsSync(p)) return p
  }
  return 'python3'
}

const PYTHON = resolvePython()
const PARSER = join(process.cwd(), 'parser', 'fit_parser.py')
const EXEC_OPTIONS = {
  timeout: 30_000,
  env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
}

function extractFitFromZip(zipPath: string, fitPath: string): void {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  console.error('[parse-fit] zip entries:', entries.map(e => e.entryName))
  const fitEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.fit'))
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
    console.error('[parse-fit] python:', PYTHON, 'parser:', PARSER, 'PATH:', EXEC_OPTIONS.env.PATH)
    execFile(PYTHON, ['-u', PARSER, fitPath], EXEC_OPTIONS, (err, stdout, stderr) => {
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

  let uploadPath: string | null = null
  let fitPath: string | null = null

  try {
    const bytes = await file.arrayBuffer()
    const buf = Buffer.from(bytes)
    console.error('[parse-fit] received bytes:', buf.length, 'first16hex:', buf.subarray(0, 16).toString('hex'))

    const isZipContent = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
    uploadPath = join(tmpdir(), `${randomUUID()}${isZipContent ? '.zip' : '.fit'}`)
    await writeFile(uploadPath, buf)

    if (isZipContent) {
      fitPath = join(tmpdir(), `${randomUUID()}.fit`)
      try {
        extractFitFromZip(uploadPath, fitPath)
      } catch (e) {
        console.error('[parse-fit] zip extract failed:', e)
        throw e
      }
      const stat = statSync(fitPath)
      const head = Buffer.alloc(16)
      const fd = openSync(fitPath, 'r')
      readSync(fd, head, 0, 16, 0)
      closeSync(fd)
      console.error('[parse-fit] extracted file size:', stat.size, 'first16hex:', head.toString('hex'))
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
    if (uploadPath) unlink(uploadPath).catch(() => {})
    if (fitPath && fitPath !== uploadPath) unlink(fitPath).catch(() => {})
  }
}
