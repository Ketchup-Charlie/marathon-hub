"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Send, RefreshCw, FolderOpen, X, Activity } from "lucide-react"
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
  role: "user" | "assistant" | "system"
  content: string
}

type AvailableRun = {
  id: string
  date: string
  title: string | null
  run_type_tag: string | null
  total_distance: number | null
  avg_pace: string | null
  avg_hr: number | null
  avg_cadence: number | null
  avg_gct: number | null
}

type RunLap = {
  lap_number: number
  distance: number | null
  avg_pace: string | null
  avg_hr: number | null
  avg_cadence: number | null
  avg_gct: number | null
}

type RunTimeseriesPoint = {
  seconds_elapsed: number
  pace_sec_per_km: number | null
  hr: number | null
  cadence: number | null
}

type LoadedRun = AvailableRun & {
  laps: RunLap[]
  timeseries: RunTimeseriesPoint[]
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

/* ─── Constants ──────────────────────────────────────────── */

const PRE_RUN_PROMPT =
  "Give me a pre-run check for today. Assess my readiness, HRV, sleep, and confirm or modify today's planned workout."

const CHIPS: { label: string; prompt: string }[] = [
  { label: "PRE_RUN CHECK",            prompt: PRE_RUN_PROMPT },
  { label: "AM I ON TRACK FOR 4:15?",  prompt: "AM I ON TRACK FOR 4:15?" },
  { label: "HOW IS MY TRAINING THIS WEEK?", prompt: "HOW IS MY TRAINING THIS WEEK?" },
  { label: "ANALYSE MY LAST RUN",      prompt: "ANALYSE MY LAST RUN" },
]

/* ─── Helpers ────────────────────────────────────────────── */

function fmtPaceSecs(secsPerKm: number | null): string {
  if (secsPerKm == null || isNaN(secsPerKm)) return "N/A"
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/* ─── Context string builder ─────────────────────────────── */

function buildContextString(props: Props, loadedRuns: LoadedRun[]): string {
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

  if (loadedRuns.length > 0) {
    lines.push("")
    lines.push("LOADED_RUNS:")
    loadedRuns.forEach((run, idx) => {
      const dist = run.total_distance != null ? `${run.total_distance.toFixed(1)}km` : "N/A"
      const pace = run.avg_pace ?? "N/A"
      const hr = run.avg_hr != null ? ` | avg HR ${run.avg_hr}` : ""
      const gct = run.avg_gct != null ? ` | avg GCT ${run.avg_gct}ms` : ""
      const cad = run.avg_cadence != null ? ` | avg cadence ${run.avg_cadence}` : ""
      lines.push(`RUN_${idx + 1}: ${run.date} | ${run.run_type_tag ?? "Run"} | ${dist} | avg pace ${pace}${hr}${gct}${cad}`)

      if (run.laps.length > 0) {
        const lapStr = run.laps.map(l => {
          const d = l.distance != null ? `${l.distance.toFixed(1)}km` : ""
          const p = l.avg_pace ?? ""
          const h = l.avg_hr != null ? ` HR${l.avg_hr}` : ""
          return `${l.lap_number}: ${d} ${p}${h}`.trim()
        }).join(" | ")
        lines.push(`  LAPS: ${lapStr}`)
      }

      // Downsample to every 2 minutes (every 12th point at 10s intervals)
      const sampled = run.timeseries.filter((_, i) => i % 12 === 0)
      if (sampled.length > 0) {
        const tsStr = sampled.map(pt => {
          const minStr = `${Math.floor(pt.seconds_elapsed / 60)}min`
          const paceStr = pt.pace_sec_per_km != null ? `pace:${fmtPaceSecs(pt.pace_sec_per_km)}` : ""
          const hrStr = pt.hr != null ? `HR:${pt.hr}` : ""
          const cadStr = pt.cadence != null ? `cad:${pt.cadence}` : ""
          return [minStr, paceStr, hrStr, cadStr].filter(Boolean).join(" ")
        }).join(" | ")
        lines.push(`  TIMESERIES: ${tsStr}`)
      }
    })
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

  // Run selector state
  const [runPanelOpen, setRunPanelOpen] = useState(false)
  const [availableRuns, setAvailableRuns] = useState<AvailableRun[]>([])
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set())
  const [loadedRuns, setLoadedRuns] = useState<LoadedRun[]>([])
  const [runPanelLoading, setRunPanelLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoSendDoneRef = useRef(false)
  // Ref always points to latest sendMessage — used by the auto-send effect
  const sendMessageRef = useRef<((text: string, contextOverride?: string) => Promise<void>) | null>(null)

  /* ── Core send logic ────────────────────────────────────── */

  const sendMessage = useCallback(async (text: string, contextOverride?: string) => {
    if (isLoading) return

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

    const context = contextOverride ?? buildContextString(props, loadedRuns)
    const history = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

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
  }, [isLoading, messages, props, loadedRuns, userId])

  // Keep ref pointing to latest sendMessage so effects with stale closures can still call it
  sendMessageRef.current = sendMessage

  /* ── Handle textarea send ───────────────────────────────── */

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")

    // /new — clear session locally and in Supabase
    if (text === "/new") {
      setMessages([{ role: "system", content: "SYSTEM: New session started. Context refreshed." }])
      if (userId) {
        const supabase = createClient()
        supabase.from("chat_messages").delete().eq("user_id", userId)
          .then(({ error }) => { if (error) console.error("chat_messages delete:", error) })
      }
      return
    }

    await sendMessage(text)
  }, [input, isLoading, sendMessage, userId])

  /* ── Sync ───────────────────────────────────────────────── */

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

  /* ── Run panel ──────────────────────────────────────────── */

  async function handleOpenRunPanel() {
    if (runPanelOpen) {
      setRunPanelOpen(false)
      return
    }
    setRunPanelOpen(true)
    setContextExpanded(false)
    if (availableRuns.length > 0) return
    setRunPanelLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("completed_runs")
      .select("id, date, title, run_type_tag, total_distance, avg_pace, avg_hr, avg_cadence, avg_gct")
      .order("date", { ascending: false })
      .limit(20)
    setAvailableRuns((data ?? []) as AvailableRun[])
    setRunPanelLoading(false)
  }

  async function handleLoadRuns() {
    if (selectedRunIds.size === 0) {
      setRunPanelOpen(false)
      return
    }
    const supabase = createClient()
    const ids = Array.from(selectedRunIds)
    const runDetails = await Promise.all(ids.map(async id => {
      const base = availableRuns.find(r => r.id === id)!
      const [lapsRes, tsRes] = await Promise.all([
        supabase
          .from("run_laps")
          .select("lap_number, distance, avg_pace, avg_hr, avg_cadence, avg_gct")
          .eq("run_id", id)
          .order("lap_number"),
        supabase
          .from("run_timeseries")
          .select("seconds_elapsed, pace_sec_per_km, hr, cadence")
          .eq("run_id", id)
          .order("seconds_elapsed"),
      ])
      return {
        ...base,
        laps: (lapsRes.data ?? []) as RunLap[],
        timeseries: (tsRes.data ?? []) as RunTimeseriesPoint[],
      } as LoadedRun
    }))
    setLoadedRuns(runDetails)
    setRunPanelOpen(false)
  }

  function toggleRunSelection(id: string) {
    setSelectedRunIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      }
      return next
    })
  }

  function dismissRun(id: string) {
    setLoadedRuns(prev => prev.filter(r => r.id !== id))
    setSelectedRunIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /* ── Init: load chat history + userId ───────────────────── */

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

  /* ── Auto-load run from ?run_id= and send analysis prompt ── */

  useEffect(() => {
    if (!userId || autoSendDoneRef.current) return
    const runId = new URLSearchParams(window.location.search).get("run_id")
    if (!runId) return

    autoSendDoneRef.current = true

    ;(async () => {
      const supabase = createClient()
      const [runRes, lapsRes, tsRes] = await Promise.all([
        supabase
          .from("completed_runs")
          .select("id, date, title, run_type_tag, total_distance, avg_pace, avg_hr, avg_cadence, avg_gct")
          .eq("id", runId)
          .maybeSingle(),
        supabase
          .from("run_laps")
          .select("lap_number, distance, avg_pace, avg_hr, avg_cadence, avg_gct")
          .eq("run_id", runId)
          .order("lap_number"),
        supabase
          .from("run_timeseries")
          .select("seconds_elapsed, pace_sec_per_km, hr, cadence")
          .eq("run_id", runId)
          .order("seconds_elapsed"),
      ])

      if (!runRes.data) return

      const loadedRun: LoadedRun = {
        ...(runRes.data as AvailableRun),
        laps: (lapsRes.data ?? []) as RunLap[],
        timeseries: (tsRes.data ?? []) as RunTimeseriesPoint[],
      }

      setLoadedRuns([loadedRun])
      setSelectedRunIds(new Set([loadedRun.id]))

      // Build context now with the freshly loaded run — don't rely on state settling
      const ctx = buildContextString(props, [loadedRun])
      const prompt = "I just completed this run. Analyse my performance, highlight any biomechanics flags, and compare to my recent sessions."
      await sendMessageRef.current?.(prompt, ctx)
    })()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ── Derived display values ─────────────────────────────── */

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

  const realMessageCount = messages.filter(m => m.role !== "system").length
  const showChips = realMessageCount < 2

  /* ── Render ─────────────────────────────────────────────── */

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

      {/* ── Context / tool bar ──────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--outline-variant)", flexShrink: 0 }}>
        <div
          className="flex items-center"
          style={{ backgroundColor: "var(--surface-container-lowest)" }}
        >
          {/* expand context snapshot */}
          <button
            onClick={() => { setContextExpanded(v => !v); setRunPanelOpen(false) }}
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

          {/* pre-run check button */}
          <button
            onClick={() => sendMessage(PRE_RUN_PROMPT)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 label-caps transition-colors flex-shrink-0"
            style={{
              color: isLoading ? "var(--on-surface-variant)" : "var(--teal)",
              opacity: isLoading ? 0.4 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
              borderLeft: "1px solid var(--outline-variant)",
            }}
          >
            <Activity size={11} />
            <span>PRE_RUN_CHECK</span>
          </button>

          {/* load runs button */}
          <button
            onClick={handleOpenRunPanel}
            className="flex items-center gap-1.5 px-3 py-2 label-caps transition-colors flex-shrink-0"
            style={{
              color: runPanelOpen || loadedRuns.length > 0 ? "var(--teal)" : "var(--on-surface-variant)",
              borderLeft: "1px solid var(--outline-variant)",
            }}
          >
            <FolderOpen size={11} />
            <span>LOAD_RUNS{loadedRuns.length > 0 ? ` (${loadedRuns.length})` : ""}</span>
          </button>

          {/* sync button */}
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

        {/* context snapshot expanded */}
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

        {/* run selector panel */}
        {runPanelOpen && (
          <div
            className="px-4 py-3 text-[11px]"
            style={{
              backgroundColor: "var(--surface-container)",
              borderTop: "1px solid var(--outline-variant)",
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps" style={{ color: "var(--teal)" }}>
                SELECT_RUNS — max 3
              </span>
              <button
                onClick={handleLoadRuns}
                className="label-caps px-3 py-1 transition-colors"
                style={{
                  backgroundColor: selectedRunIds.size > 0 ? "var(--teal)" : "var(--surface-container-high)",
                  color: selectedRunIds.size > 0 ? "var(--on-teal)" : "var(--on-surface-variant)",
                }}
              >
                LOAD ({selectedRunIds.size})
              </button>
            </div>

            {runPanelLoading ? (
              <div style={{ color: "var(--on-surface-variant)" }}>loading runs...</div>
            ) : availableRuns.length === 0 ? (
              <div style={{ color: "var(--on-surface-variant)" }}>no completed runs found</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {availableRuns.map(run => {
                  const selected = selectedRunIds.has(run.id)
                  const disabled = !selected && selectedRunIds.size >= 3
                  return (
                    <label
                      key={run.id}
                      className="flex items-center gap-3 px-2 py-1.5"
                      style={{
                        backgroundColor: selected ? "var(--surface-container-high)" : "transparent",
                        opacity: disabled ? 0.35 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => toggleRunSelection(run.id)}
                        style={{ accentColor: "var(--teal)", cursor: disabled ? "not-allowed" : "pointer" }}
                      />
                      <span style={{ color: "var(--on-surface-variant)", minWidth: 80 }}>{run.date}</span>
                      <span style={{ color: "var(--on-surface)" }}>{run.run_type_tag ?? "Run"}</span>
                      {run.total_distance != null && (
                        <span style={{ color: "var(--on-surface-variant)" }}>{run.total_distance.toFixed(1)}km</span>
                      )}
                      {run.avg_pace && (
                        <span style={{ color: "var(--on-surface-variant)" }}>@{run.avg_pace}/km</span>
                      )}
                      {run.title && (
                        <span className="truncate" style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}>{run.title}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Loaded run tags ──────────────────────────────────── */}
      {loadedRuns.length > 0 && (
        <div
          className="flex flex-wrap gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--outline-variant)", backgroundColor: "var(--surface-container-lowest)" }}
        >
          {loadedRuns.map(run => (
            <div
              key={run.id}
              className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] label-caps"
              style={{ border: "1px solid var(--teal)", color: "var(--teal)", fontFamily: "monospace" }}
            >
              <span>
                {run.date} {run.run_type_tag ?? "Run"}{run.total_distance != null ? ` ${run.total_distance.toFixed(1)}km` : ""}
              </span>
              <button
                onClick={() => dismissRun(run.id)}
                className="flex items-center"
                style={{ color: "var(--teal)", lineHeight: 1 }}
                aria-label="Remove run"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

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
            {msg.role === "system" ? (
              <div
                className="w-full text-center text-[10px] uppercase tracking-widest py-1"
                style={{ color: "var(--teal)", fontFamily: "monospace", opacity: 0.75 }}
              >
                {msg.content}
              </div>
            ) : msg.role === "user" ? (
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

      {/* ── Suggested chips ──────────────────────────────────── */}
      {showChips && (
        <div
          className="flex flex-wrap gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderTop: "1px solid var(--outline-variant)" }}
        >
          {CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
              disabled={isLoading}
              className="label-caps px-3 py-1.5 transition-colors"
              style={{
                border: "1px solid var(--teal)",
                color: isLoading ? "var(--on-surface-variant)" : "var(--teal)",
                opacity: isLoading ? 0.4 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: 10,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

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
          placeholder="ask active rick... (type /new to reset session)"
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
