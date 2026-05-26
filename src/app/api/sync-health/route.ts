import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
  }

  const ownerEmail = process.env.HERMES_OWNER_EMAIL
  if (!ownerEmail || user.email !== ownerEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const base = process.env.HERMES_API_URL
  const key  = process.env.HERMES_API_KEY
  if (!base || !key) {
    return NextResponse.json({ error: "HERMES_NOT_CONFIGURED" }, { status: 500 })
  }

  const upstream = await fetch(`${base}/sync/trigger`, {
    method: "POST",
    headers: { "X-API-Key": key },
  })

  if (!upstream.ok) {
    const body = await upstream.text()
    return NextResponse.json({ error: body || "UPSTREAM_ERROR" }, { status: upstream.status })
  }

  return NextResponse.json({ ok: true })
}
