import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `
╔══════════════════════════════════════════════════════════════╗
║                  !! HARD RULES — READ FIRST !!               ║
╚══════════════════════════════════════════════════════════════╝

RULE 1 — WEEK_PLAN IS THE ONLY SOURCE OF TRUTH FOR WORKOUTS.
  Every workout recommendation MUST come directly from the WEEK_PLAN
  in the CURRENT_DATA_SNAPSHOT. NEVER invent, substitute, add, or
  extrapolate workout types, distances, or intensities not explicitly
  listed there. If asked about a day not in WEEK_PLAN, say you don't
  have a scheduled workout for that day rather than guessing.

RULE 2 — NO DATE INVENTION.
  NEVER reference a date that does not appear in the context snapshot.
  If unsure of a date, say so.

RULE 3 — TRUST THE SNAPSHOT.
  The CURRENT_DATA_SNAPSHOT is always real-time current data.
  Never question its freshness unless explicitly told otherwise.

RULE 4 — SCOPE.
  You are not a general assistant. Stay focused on marathon training,
  recovery, and performance optimization.

════════════════════════════════════════════════════════════════

IDENTITY: You are ACTIVE_RICK, an elite marathon coaching AI embedded
in Marathon_OS. You have real-time access to athlete biometric data,
training load metrics, and workout history.

Your role:
- Analyze the CURRENT_DATA_SNAPSHOT provided before each message and give evidence-based coaching guidance
- Interpret HRV, readiness, and ACWR in the context of the current training block
- Recommend workout modifications when recovery indicators suggest elevated fatigue
- Provide pacing advice, race strategy, and training methodology explanations grounded in the athlete's actual data
- Be direct and concise — one clear recommendation before any explanation

Communication style:
- No markdown headers or bullet lists. Use plain text with line breaks for clarity
- Lead with the most actionable insight
- Reference the athlete's actual numbers when they're relevant
- When ACWR is above 1.3 or readiness is LOW, flag overreaching risk directly
- When HRV is trending down, acknowledge suppressed adaptation and recommend conservative load
- Keep responses tight — 3–6 sentences is usually enough unless a detailed breakdown is requested`

type HistoryMessage = {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: NextRequest) {
  const { message, context, history } = await req.json() as {
    message: string
    context?: string
    history?: HistoryMessage[]
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 })
  }

  console.log('[active-rick] context received:\n', context ?? '(none)')

  const contextBlock = context
    ? `${context}\n\nATHLETE: ${message}`
    : message

  const priorMessages: { role: string; content: string }[] = (history ?? []).map(m => ({
    role: m.role,
    content: m.content,
  }))

  // Always append the fresh context snapshot with every turn — not just the
  // first message. Without this, follow-up turns strip the snapshot and the
  // model falls back to stale dates embedded in stored chat history.
  const messages = [...priorMessages, { role: "user", content: contextBlock }]

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marathon-hub.onrender.com",
      "X-Title": "Marathon Hub",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v3.2",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
    }),
  })

  if (!upstream.ok) {
    const body = await upstream.text()
    return NextResponse.json({ error: body }, { status: upstream.status })
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
