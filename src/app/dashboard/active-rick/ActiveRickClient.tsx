"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Send, RefreshCw } from "lucide-react"
import type { MetricsSummary, TrainingLoadPoint } from "@/lib/hermes"
import { createClient } from "@/lib/supabase/client"
import type {
  ActiveRickRecentRun,
  ActiveRickPlannedWorkout,
  ActiveRickRaceConfig,
  ActiveRickBlock,
} from "./page"

/* ─── Types ──────────────────────────────────────────────── */

type Message = {
  role: "user" | "assistant"
  content: string
}

type Props = {
  summary: MetricsSummary | null
  trainingLoad: TrainingLoadPoint[]
  recentRuns: ActiveRickRecentRun[]
  plannedWorkouts: ActiveRickPlannedWorkout[]
  raceConfig: ActiveRickRaceConfig
  todayStr: string
  block: ActiveRickBlock
}

/* ─── Context string builder ─────────────────────────────── */

function buildContextString(props: Props): string {
  const { summary, trainingLoad, recentRuns, plannedWorkouts, raceConfig, block } = props
  // Always compute today's date fresh on the client so it reflects the real
  // current date — never rely on the server-rendered prop which can be stale.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" })
  const lines: string[] = ["CURRENT_DATA_SNAPSHOT:"]

  lines.push(`DATE: ${todayStr}`)
  const raceDate = raceConfig?.race_date ?? block?.race_date
  if (block) {
    const start = new Date(block.start_date + "T00:00:00")
    const today = new Date(todayStr + "T00:00:00")
    const weekNum = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
    let blockLine = `BLOCK: W${weekNum} of ${block.total_weeks}`
    if (block.phase) blockLine += ` | PHASE: ${block.phase.toUpperCase()}`
    blockLine += ` | STARTED: ${block.start_date}`
    if (raceDate) {
      const race = new Date(raceDate + "T00:00:00")
      const daysToRace = Math.round((race.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      blockLine += ` | DAYS_TO_RACE: ${daysToRace}`
    }
    lines.push(blockLine)
  } else if (raceDate) {
    const today = new Date(todayStr + "T00:00:00")
    const race = new Date(raceDate + "T00:00:00")
    const daysToRace = Math.round((race.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
    lines.push(`DAYS_TO_RACE: ${daysToRace}`)
  }

  if (summary) {
    lines.push(
      `READINESS: ${summary.readiness_score} ${summary.readiness_level} | HRV: ${summary.hrv_baseline_ms}ms | SLEEP: ${summary.sleep_score}/100`
    )
  }

  const latestLoad = trainingLoad.length > 0 ? trainingLoad[trainingLoad.length - 1] : null
  if (latestLoad) {
    const acwr = latestLoad.load_ratio != null ? latestLoad.load_ratio.toFixed(2) : "N/A"
    const status = latestLoad.acwr_status ?? ""
    const acute = latestLoad.acute_load != null ? latestLoad.acute_load.toFixed(0) : "N/A"
    const chronic = latestLoad.chronic_load != null ? latestLoad.chronic_load.toFixed(0) : "N/A"
    lines.push(`ACWR: ${acwr} ${status} | ACUTE: ${acute} | CHRONIC: ${chronic}`)
  }

  const todayPlanned = plannedWorkouts.find(w => w.date === todayStr)
  if (todayPlanned) {
    let planned = `TODAY_PLANNED: ${todayPlanned.workout_type}`
    if (todayPlanned.target_distance_km) planned += ` ${todayPlanned.target_distance_km}km`
    if (todayPlanned.description) planned += ` @ ${todayPlanned.description}`
    lines.push(planned)
  } else {
    lines.push("TODAY_PLANNED: Rest / unscheduled")
  }

  // Compute tomorrow's date using local components to avoid UTC day-shift on UTC+ servers
  const tomorrowDate = new Date(todayStr + "T00:00:00")
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tp = (n: number) => String(n).padStart(2, "0")
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${tp(tomorrowDate.getMonth() + 1)}-${tp(tomorrowDate.getDate())}`
  const tomorrowPlanned = plannedWorkouts.find(w => w.date === tomorrowStr)
  if (tomorrowPlanned) {
    let t = `${tomorrowPlanned.workout_type}`
    if (tomorrowPlanned.target_distance_km) t += ` ${tomorrowPlanned.target_distance_km}km`
    if (tomorrowPlanned.description) t += ` @ ${tomorrowPlanned.description}`
    lines.push(`**TOMORROW_WORKOUT: ${t}**`)
  } else {
    lines.push("**TOMORROW_WORKOUT: REST**")
  }

  if (recentRuns.length > 0) {
    lines.push("RECENT_RUNS:")
    recentRuns.slice(0, 3).forEach(run => {
      const dist = run.total_distance != null ? `${run.total_distance.toFixed(1)}km` : "N/A"
      const pace = run.avg_pace ?? "N/A"
      const hr = run.avg_hr != null ? `${run.avg_hr}bpm` : "N/A"
      const gct = run.avg_gct != null ? ` GCT:${run.avg_gct}ms` : ""
      lines.push(`  ${run.date} | ${dist} | ${pace}/km | ${hr}${gct}`)
    })
  }

  if (plannedWorkouts.length > 0) {
    lines.push("WEEK_PLAN:")
    plannedWorkouts.forEach(w => {
      const dist = w.target_distance_km != null ? ` ${w.target_distance_km}km` : ""
      const desc = w.description ? ` @ ${w.description}` : ""
      lines.push(`  ${w.date} | ${w.workout_type}${dist}${desc}`)
    })
    lines.push("")
    lines.push("⚠️ WEEK_PLAN IS AUTHORITATIVE — only recommend workouts listed above.")
    lines.push("NEVER suggest a workout type, distance, or intensity not explicitly shown in WEEK_PLAN.")
    lines.push("If asked about a day not listed, state that no workout is scheduled rather than inventing one.")
  }

  return lines.join("\n")
}

/* ─── Component ──────────────────────────────────────────── */

export default function ActiveRickClient(props: Props) {
  const { summary, trainingLoad, recentRuns, plannedWorkouts, raceConfig, todayStr, block } = props

  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSync() {
    setSyncStatus("syncing")
    try {
      const res = await fetch("/api/sync-health", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error("sync-health error:", body)
        setSyncStatus("error")
        setTimeout(() => setSyncStatus("idle"), 3000)
        return
      }
      setSyncStatus("ok")
      router.refresh()
      setTimeout(() => setSyncStatus("idle"), 2000)
    } catch (err) {
      console.error("sync-health network error:", err)
      setSyncStatus("error")
      setTimeout(() => setSyncStatus("idle"), 3000)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.auth.getSession(),
      supabase
        .from("chat_messages")
        .select("role, content")
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([{ data: { session } }, { data: history, error: histError }]) => {
      if (session?.user.id) setUserId(session.user.id)
      if (histError) console.error("chat_messages load error:", histError)
      if (history && history.length > 0) {
        setMessages(
          history.reverse().map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
        )
      }
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")
    const userMsg: Message = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const supabase = createClient()
    if (userId) {
      supabase
        .from("chat_messages")
        .insert({ role: "user", content: text, user_id: userId })
        .then(({ error }) => { if (error) console.error("chat_messages insert (user):", error) })
    }

    const context = buildContextString(props)
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    const weekPlanSection = context.match(/WEEK_PLAN:\n([\s\S]*?)(?:\n\n|$)/)
    console.log('[active-rick] WEEK_PLAN sent:\n' + (weekPlanSection ? weekPlanSection[1] : '(none)'))

    let assistantContent = ""
    try {
      const res = await fetch("/api/active-rick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context, history }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "")
        setMessages(prev => [...prev, { role: "assistant", content: `ERROR: ${res.status} — ${errText || "upstream failure"}` }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      setMessages(prev => [...prev, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content ?? ""
            if (delta) {
              assistantContent += delta
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: assistantContent }
                return updated
              })
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      if (assistantContent && userId) {
        supabase
          .from("chat_messages")
          .insert({ role: "assistant", content: assistantContent, user_id: userId })
          .then(({ error }) => { if (error) console.error("chat_messages insert (assistant):", error) })
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `NETWORK_ERROR: ${err instanceof Error ? err.message : "unknown"}` }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, messages, props])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ── Context panel data ─────────────────────────────────── */

  const latestLoad = trainingLoad.length > 0 ? trainingLoad[trainingLoad.length - 1] : null
  const todayPlanned = plannedWorkouts.find(w => w.date === todayStr) ?? null

  const acwr = latestLoad?.load_ratio != null ? latestLoad.load_ratio.toFixed(2) : null
  const acwrStatus = latestLoad?.acwr_status ?? null

  const raceDate = raceConfig?.race_date ?? block?.race_date
  let daysToRace: number | null = null
  let blockWeek: number | null = null
  if (raceDate) {
    const today = new Date(todayStr + "T00:00:00")
    const race = new Date(raceDate + "T00:00:00")
    daysToRace = Math.round((race.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  }
  if (block) {
    const start = new Date(block.start_date + "T00:00:00")
    const today = new Date(todayStr + "T00:00:00")
    blockWeek = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)", fontFamily: "monospace" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 44, backgroundColor: "var(--surface-container-lowest)", borderBottom: "1px solid var(--outline-variant)" }}
      >
        <div className="flex items-center gap-3">
          <span className="label-caps tracking-widest" style={{ color: "var(--teal)" }}>
            ACTIVE_RICK :: COACHING_ENGINE
          </span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: "#22c55e", fontSize: 10 }}>●</span>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#22c55e" }}>ONLINE</span>
          </div>
        </div>
        {(daysToRace != null || blockWeek != null) && (
          <div className="flex items-center gap-4">
            {blockWeek != null && block && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--on-surface-variant)" }}>
                W{blockWeek}/{block.total_weeks}
              </span>
            )}
            {daysToRace != null && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--on-surface-variant)" }}>
                D-{daysToRace}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Context panel ───────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--outline-variant)", flexShrink: 0 }}>
        <div
          className="flex items-center"
          style={{ backgroundColor: "var(--surface-container-lowest)" }}
        >
          <button
            onClick={() => setContextExpanded(v => !v)}
            className="flex items-center gap-2 flex-1 px-4 py-2 label-caps transition-colors"
            style={{ color: "var(--on-surface-variant)" }}
          >
            {contextExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>CONTEXT_SNAPSHOT</span>
            {summary && (
              <span className="ml-2 text-[10px]" style={{ color: "var(--on-surface-variant)" }}>
                READINESS:{" "}
                <span style={{ color: summary.readiness_level === "HIGH" ? "var(--teal)" : "var(--amber)" }}>
                  {summary.readiness_score} {summary.readiness_level}
                </span>
                {acwr && (
                  <>
                    {" "}| ACWR: <span style={{ color: "var(--on-surface)" }}>{acwr}</span>
                    {acwrStatus && <span style={{ color: "var(--on-surface-variant)" }}> {acwrStatus}</span>}
                  </>
                )}
              </span>
            )}
          </button>
          {summary && (
            <button
              onClick={handleSync}
              disabled={syncStatus === "syncing"}
              className="flex items-center gap-1.5 px-3 py-2 label-caps transition-colors flex-shrink-0"
              style={{
                color: syncStatus === "ok" ? "var(--teal)" : syncStatus === "error" ? "#e05252" : "var(--on-surface-variant)",
                opacity: syncStatus === "syncing" ? 0.6 : 1,
                cursor: syncStatus === "syncing" ? "not-allowed" : "pointer",
                borderLeft: "1px solid var(--outline-variant)",
              }}
            >
              <RefreshCw size={11} className={syncStatus === "syncing" ? "animate-spin" : ""} />
              <span>{syncStatus === "syncing" ? "SYNCING" : syncStatus === "ok" ? "SYNCED" : syncStatus === "error" ? "ERROR" : "SYNC"}</span>
            </button>
          )}
        </div>

        {contextExpanded && (
          <div
            className="px-4 py-3 text-[11px] leading-relaxed"
            style={{ backgroundColor: "var(--surface-container)", color: "var(--on-surface-variant)", fontFamily: "monospace" }}
          >
            {summary ? (
              <div className="mb-2">
                <span style={{ color: "var(--teal)" }}>HEALTH </span>
                READINESS:{" "}
                <span style={{ color: summary.readiness_level === "HIGH" ? "var(--teal)" : "var(--amber)" }}>
                  {summary.readiness_score} {summary.readiness_level}
                </span>
                {" "}| HRV: <span style={{ color: "var(--on-surface)" }}>{summary.hrv_baseline_ms}ms</span>
                {" "}| SLEEP: <span style={{ color: "var(--on-surface)" }}>{summary.sleep_score}/100</span>
              </div>
            ) : (
              <div className="mb-2 opacity-50">HEALTH — no data</div>
            )}

            {latestLoad ? (
              <div className="mb-2">
                <span style={{ color: "var(--teal)" }}>LOAD  </span>
                ACWR: <span style={{ color: "var(--on-surface)" }}>{latestLoad.load_ratio?.toFixed(2) ?? "N/A"}</span>
                {latestLoad.acwr_status && <span style={{ color: "var(--amber)" }}> {latestLoad.acwr_status}</span>}
                {" "}| ACUTE: <span style={{ color: "var(--on-surface)" }}>{latestLoad.acute_load?.toFixed(0) ?? "N/A"}</span>
                {" "}| CHRONIC: <span style={{ color: "var(--on-surface)" }}>{latestLoad.chronic_load?.toFixed(0) ?? "N/A"}</span>
              </div>
            ) : (
              <div className="mb-2 opacity-50">LOAD — no data</div>
            )}

            {todayPlanned ? (
              <div className="mb-2">
                <span style={{ color: "var(--teal)" }}>TODAY </span>
                {todayPlanned.workout_type}
                {todayPlanned.target_distance_km != null && ` ${todayPlanned.target_distance_km}km`}
                {todayPlanned.description && <span style={{ color: "var(--on-surface-variant)" }}> — {todayPlanned.description}</span>}
              </div>
            ) : (
              <div className="mb-2 opacity-50">TODAY — rest / unscheduled</div>
            )}

            {recentRuns.length > 0 && (
              <div className="mb-2">
                <div style={{ color: "var(--teal)" }} className="mb-1">RUNS</div>
                {recentRuns.slice(0, 5).map(run => (
                  <div key={run.date} className="pl-2">
                    <span style={{ color: "var(--on-surface)" }}>{run.date}</span>
                    {run.total_distance != null && <span> {run.total_distance.toFixed(1)}km</span>}
                    {run.avg_pace && <span> @{run.avg_pace}/km</span>}
                    {run.avg_hr != null && <span> HR:{run.avg_hr}</span>}
                    {run.avg_gct != null && <span> GCT:{run.avg_gct}ms</span>}
                    {run.avg_cadence != null && <span> CAD:{run.avg_cadence}</span>}
                    {run.compliance_score && (
                      <span style={{ color: run.compliance_score === "Green" ? "var(--teal)" : "var(--amber)" }}>
                        {" "}{run.compliance_score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {plannedWorkouts.length > 0 && (
              <div>
                <div style={{ color: "var(--teal)" }} className="mb-1">WEEK_PLAN</div>
                {plannedWorkouts.map(w => (
                  <div key={w.date} className="pl-2">
                    <span style={{ color: "var(--on-surface)" }}>{w.date}</span>
                    {" "}{w.workout_type}
                    {w.target_distance_km != null && ` ${w.target_distance_km}km`}
                    {w.description && <span style={{ color: "var(--on-surface-variant)" }}> — {w.description}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4" style={{ gap: 12, display: "flex", flexDirection: "column" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--on-surface-variant)" }}>
            <span className="text-[11px] uppercase tracking-widest">ACTIVE_RICK READY</span>
            <span className="text-[10px] opacity-60">ask me about your training, recovery, or race plan</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "user" ? (
              <div
                className="max-w-[70%] px-3 py-2 text-[12px] leading-relaxed"
                style={{
                  border: "1px solid var(--outline-variant)",
                  backgroundColor: "var(--surface-container)",
                  color: "var(--on-surface-variant)",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                className="max-w-[80%] text-[12px] leading-relaxed"
                style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                <span style={{ color: "var(--teal)" }}>{">"} ACTIVE_RICK: </span>
                <span style={{ color: "var(--on-surface)" }}>{msg.content}</span>
                {isLoading && i === messages.length - 1 && msg.content === "" && (
                  <span style={{ color: "var(--teal)" }} className="animate-pulse">█</span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <span className="text-[12px]" style={{ color: "var(--teal)", fontFamily: "monospace" }}>
              {">"} ACTIVE_RICK: <span className="animate-pulse">█</span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────── */}
      <div
        className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid var(--outline-variant)", backgroundColor: "var(--surface-container-lowest)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
          placeholder="ask active rick..."
          className="flex-1 bg-transparent outline-none resize-none text-[12px] leading-relaxed"
          style={{
            color: "var(--on-surface)",
            caretColor: "var(--teal)",
            fontFamily: "monospace",
            borderBottom: "1px solid var(--outline-variant)",
            paddingBottom: 4,
            maxHeight: 120,
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 label-caps transition-colors flex-shrink-0"
          style={{
            backgroundColor: isLoading || !input.trim() ? "var(--surface-container)" : "var(--teal)",
            color: isLoading || !input.trim() ? "var(--on-surface-variant)" : "var(--on-teal)",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
          }}
        >
          <Send size={12} />
          <span>SEND</span>
        </button>
      </div>
    </div>
  )
}
