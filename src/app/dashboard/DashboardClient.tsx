"use client"

import React from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { MetricsSummary, MomentumDay } from "@/lib/hermes"

/* ─── Exported types (imported by page.tsx) ──────────────── */

export type DashboardBlock = {
  id: string
  name: string
  race_date: string
  start_date: string
} | null

export type DashboardTodayWorkout = {
  workout_type: string | null
  target_distance_km: number | null
  target_metric_type: string | null
  target_metric_min: string | null
  target_metric_max: string | null
  description: string | null
} | null

export type DashboardTomorrowWorkout = {
  workout_type: string | null
  target_distance_km: number | null
  description: string | null
} | null

export type DashboardRecentRun = {
  id: string
  date: string
  title: string | null
  run_type_tag: string | null
  total_distance: number | null
  avg_pace: string | null
  avg_hr: number | null
  avg_gct: number | null
  compliance_score: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */

function scoreColor(score: number | null): string {
  if (score == null) return "var(--on-surface-variant)"
  if (score >= 80)   return "var(--teal)"
  if (score >= 60)   return "var(--amber)"
  return "#e05252"
}

function levelColor(level: string | null | undefined): string {
  if (level === "HIGH")     return "var(--teal)"
  if (level === "MODERATE") return "var(--amber)"
  if (level === "LOW")      return "#e05252"
  return "var(--on-surface-variant)"
}

function systemRec(score: number | null): string {
  if (score == null) return "AWAITING_BIOMETRIC_DATA"
  if (score >= 80)   return "SYSTEMS_NOMINAL :: FULL_CAPACITY_AUTHORIZED"
  if (score >= 60)   return "SYSTEMS_DEGRADED :: PROCEED_WITH_CAUTION"
  return "SYSTEMS_IMPAIRED :: RECOVERY_MODE_RECOMMENDED"
}

function daysToRace(raceDate: string | null): number | null {
  if (!raceDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const race = new Date(raceDate + "T00:00:00")
  const diff = Math.ceil((race.getTime() - today.getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

function blockPhase(startDate: string): string {
  const start = new Date(startDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const week = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (86_400_000 * 7)))
  return `BASE_W${week}`
}

function fmtTarget(
  type: string | null,
  min: string | null,
  max: string | null,
): string | null {
  if (!type || !min || !max) return null
  if (type === "Pace") return `${min}–${max}/km`
  if (type === "HR")   return `${min}–${max} bpm`
  return `${min}–${max}`
}

function complyColor(score: string | null): string {
  if (score === "Green")  return "var(--teal)"
  if (score === "Yellow") return "var(--amber)"
  if (score === "Red")    return "#e05252"
  return "var(--on-surface-variant)"
}

/* ─── Arc gauge ──────────────────────────────────────────── */

function ArcProgress({
  score,
  level,
  size = 80,
}: {
  score: number | null
  level: string | null | undefined
  size?: number
}) {
  const stroke = 6
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const pct    = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0
  const offset = circ * (1 - pct)
  const color  = levelColor(level)

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--surface-container-high)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="square"
        strokeDasharray={String(circ)}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  )
}

/* ─── Comply dot ─────────────────────────────────────────── */

function ComplyDot({ score }: { score: string | null }) {
  if (!score) return <span className="code-data text-[var(--on-surface-variant)]">--</span>
  return (
    <span
      className="inline-block flex-shrink-0"
      style={{ width: 8, height: 8, backgroundColor: complyColor(score) }}
    />
  )
}

/* ─── Mini heatmap ───────────────────────────────────────── */

function squareStyle(day: MomentumDay | undefined): CSSProperties {
  if (day?.hasRun)     return { backgroundColor: "var(--teal)" }
  if (day?.hasPlanned) return { backgroundColor: "transparent", border: "1px solid var(--amber)" }
  return { backgroundColor: "#1a2027" }
}

function MiniHeatmap({ days }: { days: MomentumDay[] }) {
  const dayMap = new Map(days.map((d) => [d.date, d]))
  const today  = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 2 }}>
          {Array.from({ length: 14 }, (_, col) => {
            const idx = row * 14 + col
            const d   = new Date(today)
            d.setDate(d.getDate() - idx)
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            return (
              <span
                key={col}
                title={date}
                style={{ aspectRatio: "1", minWidth: 10, minHeight: 10, display: "block", ...squareStyle(dayMap.get(date)) }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ─── Panel header ───────────────────────────────────────── */

function PanelHeader({ label, href }: { label: string; href: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 flex-shrink-0"
      style={{
        borderBottom: "1px solid var(--outline-variant)",
        backgroundColor: "var(--surface-container-low)",
      }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{label}</span>
      <Link
        href={href}
        className="label-caps transition-colors hover:text-[var(--teal)]"
        style={{ fontSize: 9, color: "var(--on-surface-variant)", textDecoration: "none" }}
      >
        →
      </Link>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function DashboardClient({
  summary,
  block,
  raceDate,
  todayStr,
  todayWorkout,
  tomorrowWorkout,
  todayCompleted,
  recentRuns,
  momentumDays,
  streak,
  weekCompleted,
  weekPlanned,
}: {
  summary:        MetricsSummary | null
  block:          DashboardBlock
  raceDate:       string | null
  todayStr:       string
  todayWorkout:   DashboardTodayWorkout
  tomorrowWorkout: DashboardTomorrowWorkout
  todayCompleted: boolean
  recentRuns:     DashboardRecentRun[]
  momentumDays:   MomentumDay[]
  streak:         number
  weekCompleted:  number
  weekPlanned:    number
}) {
  const router = useRouter()

  const readinessScore = summary?.readiness_score ?? null
  const readinessLevel = summary?.readiness_level ?? null
  const days           = daysToRace(raceDate)
  const phase          = block ? blockPhase(block.start_date) : null

  const todayDate = new Date(todayStr + "T00:00:00")
  const weekday   = todayDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  const monthDay  = todayDate.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()
  const dateLabel = `${weekday}, ${monthDay}`

  const TABLE_COLS = "90px 1fr 80px 72px 72px 52px 72px 52px"
  const TABLE_HEADERS = ["DATE", "TITLE", "TYPE", "DIST", "PACE", "HR", "GCT", "COMPLY"]

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

      {/* ── DAILY_BRIEF ──────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <span className="label-caps" style={{ color: "var(--teal)" }}>{dateLabel}</span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>

        {days != null ? (
          <span className="label-caps text-[var(--on-surface-variant)]">
            DAYS_TO_RACE:{" "}
            <span className="text-[var(--on-surface)]">{days}</span>
          </span>
        ) : (
          <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.45 }}>
            NO_RACE_CONFIG
          </span>
        )}

        <span className="label-caps text-[var(--on-surface-variant)]">::</span>

        {phase ? (
          <span className="label-caps text-[var(--on-surface-variant)]">
            PHASE:{" "}
            <span className="text-[var(--on-surface)]">{phase}</span>
          </span>
        ) : (
          <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.45 }}>
            NO_ACTIVE_BLOCK
          </span>
        )}
      </div>

      {/* ── TOP ROW ──────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: "1px solid var(--outline-variant)", minHeight: 272 }}
      >

        {/* RECOVERY_SNAPSHOT */}
        <div
          className="flex flex-col"
          style={{ flex: "1 1 0", borderRight: "1px solid var(--outline-variant)", minWidth: 0 }}
        >
          <PanelHeader label="RECOVERY_SNAPSHOT" href="/dashboard/recovery-score" />

          <div className="flex flex-col flex-1 px-4 py-4 gap-3">
            {/* Arc + score + level */}
            <div className="flex items-center gap-4">
              <div
                className="relative flex items-center justify-center flex-shrink-0"
                style={{ width: 80, height: 80 }}
              >
                <ArcProgress score={readinessScore} level={readinessLevel} size={80} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="metric-lg"
                    style={{ color: levelColor(readinessLevel), fontSize: 22, lineHeight: 1 }}
                  >
                    {readinessScore ?? "--"}
                  </span>
                  <span
                    className="label-caps text-[var(--on-surface-variant)]"
                    style={{ fontSize: 7, marginTop: 2 }}
                  >
                    READINESS
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div
                  className="inline-flex items-center px-2 py-0.5"
                  style={{
                    border: `1px solid ${levelColor(readinessLevel)}`,
                    alignSelf: "flex-start",
                  }}
                >
                  <span className="label-caps" style={{ fontSize: 9, color: levelColor(readinessLevel) }}>
                    {readinessLevel ?? "UNKNOWN"}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>
                    HRV:{" "}
                    <span style={{ color: "var(--on-surface)" }}>
                      {summary?.hrv_baseline_ms != null ? `${Math.round(summary.hrv_baseline_ms)} ms` : "--"}
                    </span>
                  </span>
                  <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>
                    SLEEP:{" "}
                    <span style={{ color: "var(--on-surface)" }}>
                      {summary?.sleep_score != null ? summary.sleep_score : "--"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* System status */}
            <div
              className="flex flex-col px-3 py-2"
              style={{
                backgroundColor: "var(--surface-container-low)",
                borderLeft: `2px solid ${scoreColor(readinessScore)}`,
              }}
            >
              <span
                className="label-caps text-[var(--on-surface-variant)]"
                style={{ fontSize: 8, marginBottom: 3 }}
              >
                SYSTEM_STATUS
              </span>
              <span
                className="label-caps"
                style={{ color: scoreColor(readinessScore), fontSize: 9, letterSpacing: "0.06em" }}
              >
                {systemRec(readinessScore)}
              </span>
            </div>
          </div>
        </div>

        {/* TODAYS_MISSION */}
        <div
          className="flex flex-col"
          style={{ flex: "1 1 0", borderRight: "1px solid var(--outline-variant)", minWidth: 0 }}
        >
          <PanelHeader label="TODAYS_MISSION" href="/dashboard/training-blocks" />

          <div className="flex flex-col flex-1 px-4 py-4 gap-3">
            {/* Today */}
            {todayWorkout ? (
              <div
                className="flex flex-col gap-1.5 p-3"
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  border: "1px solid var(--outline-variant)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                    TODAY
                  </span>
                  {todayCompleted && (
                    <span
                      className="inline-block"
                      style={{ width: 8, height: 8, backgroundColor: "var(--teal)" }}
                    />
                  )}
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 13 }}>
                    {todayWorkout.workout_type ?? "—"}
                  </span>
                  {todayWorkout.target_distance_km != null && (
                    <span className="code-data text-[var(--on-surface-variant)]">
                      {todayWorkout.target_distance_km} km
                    </span>
                  )}
                </div>

                {fmtTarget(todayWorkout.target_metric_type, todayWorkout.target_metric_min, todayWorkout.target_metric_max) && (
                  <span className="code-data" style={{ color: "var(--amber)", fontSize: 11 }}>
                    {fmtTarget(todayWorkout.target_metric_type, todayWorkout.target_metric_min, todayWorkout.target_metric_max)}
                  </span>
                )}

                {todayWorkout.description && (
                  <span
                    className="code-data text-[var(--on-surface-variant)]"
                    style={{ fontSize: 10, opacity: 0.8 }}
                  >
                    {todayWorkout.description}
                  </span>
                )}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-1 py-5"
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  border: "1px solid var(--outline-variant)",
                }}
              >
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>
                  REST
                </span>
                <span
                  className="label-caps text-[var(--on-surface-variant)]"
                  style={{ fontSize: 8, opacity: 0.5 }}
                >
                  NO_WORKOUT_SCHEDULED
                </span>
              </div>
            )}

            {/* Tomorrow preview */}
            <div className="flex flex-col gap-1" style={{ opacity: 0.5 }}>
              <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                TOMORROW
              </span>
              {tomorrowWorkout ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 10 }}>
                    {tomorrowWorkout.workout_type ?? "—"}
                  </span>
                  {tomorrowWorkout.target_distance_km != null && (
                    <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 10 }}>
                      {tomorrowWorkout.target_distance_km} km
                    </span>
                  )}
                </div>
              ) : (
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>
                  REST
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MOMENTUM_SNAPSHOT */}
        <div className="flex flex-col" style={{ flex: "1 1 0", minWidth: 0 }}>
          <PanelHeader label="MOMENTUM_SNAPSHOT" href="/dashboard/progression" />

          <div className="flex flex-col flex-1 px-4 py-4 gap-4">
            <MiniHeatmap days={momentumDays} />

            <div className="flex items-center gap-5">
              <div className="flex flex-col">
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                  STREAK
                </span>
                <span
                  className="metric-lg"
                  style={{ color: streak > 0 ? "var(--teal)" : "var(--on-surface-variant)", fontSize: 22, lineHeight: 1.1 }}
                >
                  {streak}
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                  DAYS
                </span>
              </div>

              <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--outline-variant)" }} />

              <div className="flex flex-col">
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                  THIS_WEEK
                </span>
                <span className="metric-lg" style={{ color: "var(--on-surface)", fontSize: 22, lineHeight: 1.1 }}>
                  {weekCompleted}<span style={{ color: "var(--on-surface-variant)", fontSize: 14 }}>/{weekPlanned > 0 ? weekPlanned : "—"}</span>
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>
                  SESSIONS
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-auto">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block"
                  style={{ width: 8, height: 8, backgroundColor: "var(--teal)" }}
                />
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>RAN</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block"
                  style={{ width: 8, height: 8, border: "1px solid var(--amber)", backgroundColor: "transparent" }}
                />
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>MISSED</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block"
                  style={{ width: 8, height: 8, backgroundColor: "#1a2027" }}
                />
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>REST</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── RECENT_ACTIVITY ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

        {/* Section header */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{
            borderBottom: "1px solid var(--outline-variant)",
            backgroundColor: "var(--surface-container-low)",
          }}
        >
          <span className="label-caps text-[var(--on-surface)]">RECENT_ACTIVITY</span>
          <Link
            href="/dashboard/run-analysis"
            className="label-caps transition-colors hover:text-[var(--teal)]"
            style={{ fontSize: 9, color: "var(--on-surface-variant)", textDecoration: "none" }}
          >
            VIEW_ALL →
          </Link>
        </div>

        {/* Column headers */}
        <div
          className="grid px-4 py-1.5 flex-shrink-0"
          style={{
            gridTemplateColumns: TABLE_COLS,
            borderBottom: "1px solid var(--outline-variant)",
            backgroundColor: "var(--surface-container-low)",
          }}
        >
          {TABLE_HEADERS.map((col) => (
            <span key={col} className="label-caps text-[var(--on-surface-variant)]">{col}</span>
          ))}
        </div>

        {/* Rows */}
        {recentRuns.length === 0 ? (
          <div className="px-4 py-6">
            <span
              className="code-data text-[var(--on-surface-variant)]"
              style={{ opacity: 0.5 }}
            >
              NO_SESSIONS — upload a run to get started
            </span>
          </div>
        ) : (
          recentRuns.map((run) => (
            <div
              key={run.id}
              className="grid items-center px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-container)]"
              style={{
                gridTemplateColumns: TABLE_COLS,
                borderBottom: "1px solid var(--outline-variant)",
              }}
              onClick={() => router.push(`/dashboard/run-analysis/${run.id}`)}
            >
              <span className="code-data text-[var(--on-surface-variant)]">{run.date}</span>
              <span
                className="code-data text-[var(--on-surface)] truncate pr-2"
                title={run.title ?? ""}
              >
                {run.title ?? "--"}
              </span>
              <span className="code-data text-[var(--on-surface)]">
                {run.run_type_tag ?? "--"}
              </span>
              <span className="code-data text-[var(--on-surface)]">
                {run.total_distance != null ? `${run.total_distance.toFixed(2)} km` : "--"}
              </span>
              <span className="code-data text-[var(--on-surface)]">
                {run.avg_pace ?? "--"}
              </span>
              <span className="code-data text-[var(--on-surface)]">
                {run.avg_hr != null ? Math.round(run.avg_hr) : "--"}
              </span>
              <span className="code-data text-[var(--on-surface)]">
                {run.avg_gct != null ? `${Math.round(run.avg_gct)} ms` : "--"}
              </span>
              <div className="flex items-center">
                <ComplyDot score={run.compliance_score} />
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
