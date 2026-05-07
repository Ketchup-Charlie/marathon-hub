"use client"

import React, { useMemo } from "react"
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import type {
  MetricsSummary,
  ReadinessTrendPoint,
  SleepTrendPoint,
} from "@/lib/hermes"

/* ─── Types ──────────────────────────────────────────────── */

export type TomorrowWorkout = {
  workout_type:        string
  target_distance_km:  number | null
  description:         string | null
} | null

type ReadinessRow = ReadinessTrendPoint & { amPm: string | null }

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
  if (level === "POOR")     return "#ff0000"
  return "var(--on-surface-variant)"
}

function feedbackRank(feedback: string | null | undefined): number {
  if (!feedback) return 99
  const lower = feedback.toLowerCase()
  if (lower.includes("poor"))                                          return 0
  if (lower.includes("low") || lower.includes("limit") || lower.includes("impair")) return 1
  if (lower.includes("moderate") || lower.includes("caution"))        return 2
  if (lower.includes("good") || lower.includes("optimal") || lower.includes("support")) return 3
  return 99
}

function getDominantFactor(
  hrv:   string | null | undefined,
  sleep: string | null | undefined,
): { label: string; color: string } {
  const hr = feedbackRank(hrv)
  const sr = feedbackRank(sleep)
  if (hr === 3 && sr === 3)  return { label: "OPTIMAL",  color: "var(--teal)" }
  if (hr === sr)             return { label: "BALANCED",  color: "var(--on-surface-variant)" }
  if (hr < sr)               return { label: "HRV",       color: "#e05252" }
  return                            { label: "SLEEP",     color: "#e05252" }
}

function fmtDate(d: string | null | undefined): string {
  return d ? d.split("T")[0] : "--"
}

function fmtSleep(mins: number | null): string {
  if (mins == null) return "--"
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${m}m`
}

function factorStatus(feedback: string | null | undefined): string {
  if (!feedback) return "var(--on-surface-variant)"
  const lower = feedback.toLowerCase()
  if (lower.includes("optimal") || lower.includes("good") || lower.includes("support")) return "var(--teal)"
  if (lower.includes("low") || lower.includes("poor") || lower.includes("impair") || lower.includes("limit")) return "#e05252"
  return "var(--amber)"
}

function systemRec(score: number | null): string {
  if (score == null) return "AWAITING_BIOMETRIC_DATA"
  if (score >= 80)   return "SYSTEMS_NOMINAL :: FULL_CAPACITY_AUTHORIZED"
  if (score >= 60)   return "SYSTEMS_DEGRADED :: PROCEED_WITH_CAUTION"
  return "SYSTEMS_IMPAIRED :: RECOVERY_MODE_RECOMMENDED"
}

function getRecommendation(
  score: number | null,
  workout: TomorrowWorkout,
): { action: string; detail: string; color: string } {
  if (score == null) {
    return {
      action: "NO_DATA",
      detail: "Cannot assess without biometric data.",
      color: "var(--on-surface-variant)",
    }
  }
  if (score >= 80) {
    return {
      action: "AUTHORIZED",
      detail: workout
        ? `Execute ${workout.workout_type}${workout.target_distance_km ? ` — ${workout.target_distance_km} km` : ""} as scheduled.`
        : "No workout scheduled. Light activity permitted.",
      color: "var(--teal)",
    }
  }
  if (score >= 60) {
    return {
      action: "CAUTION",
      detail: workout
        ? `Reduce intensity 15–20%. ${workout.workout_type} at modified effort.`
        : "Monitor response. Keep effort aerobic.",
      color: "var(--amber)",
    }
  }
  const isHard =
    workout != null &&
    ["INTERVAL", "TEMPO", "RACE_PACE", "THRESHOLD"].includes(
      workout.workout_type.toUpperCase(),
    )
  if (isHard) {
    return {
      action: "DOWNGRADE",
      detail: `${workout!.workout_type} → replace with EASY. HRV/sleep indicators insufficient for high-intensity load.`,
      color: "#e05252",
    }
  }
  return {
    action: "REST_DAY",
    detail: "Physiological markers indicate recovery deficit. Postpone structured training.",
    color: "#e05252",
  }
}

/* ─── ArcProgress ────────────────────────────────────────── */

function ArcProgress({
  score,
  level,
}: {
  score: number | null
  level: string | null | undefined
}) {
  const size   = 120
  const stroke = 8
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const pct    = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0
  const offset = circ * (1 - pct)
  const color  = levelColor(level)

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
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

/* ─── MiniStat ───────────────────────────────────────────── */

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="label-caps text-[var(--on-surface-variant)]"
        style={{ fontSize: 8 }}
      >
        {label}
      </span>
      <span
        className="metric-lg"
        style={{ color: color ?? "var(--on-surface)", fontSize: 20 }}
      >
        {value}
      </span>
    </div>
  )
}

/* ─── No data placeholder ────────────────────────────────── */

function NoData({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <span
        className="label-caps text-[var(--on-surface-variant)]"
        style={{ opacity: 0.35 }}
      >
        NO_DATA
      </span>
    </div>
  )
}

/* ─── Tooltip style ──────────────────────────────────────── */

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--surface-container-high)",
    border: "1px solid var(--outline-variant)",
    borderRadius: 0,
    padding: "6px 10px",
  },
  labelStyle: {
    color: "var(--on-surface-variant)",
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    marginBottom: 2,
  },
  itemStyle: { fontSize: 11, padding: 0 },
  cursor: { stroke: "var(--outline-variant)", strokeWidth: 1 },
}

/* ─── Main component ─────────────────────────────────────── */

export default function RecoveryScoreClient({
  summary,
  readinessTrend,
  sleepTrend,
  tomorrowWorkout,
}: {
  summary:         MetricsSummary | null
  readinessTrend:  ReadinessTrendPoint[]
  sleepTrend:      SleepTrendPoint[]
  tomorrowWorkout: TomorrowWorkout
}) {
  const latestReadiness = readinessTrend[readinessTrend.length - 1] ?? null
  const latestSleep     = sleepTrend[sleepTrend.length - 1]         ?? null

  const readinessScore = summary?.readiness_score  ?? latestReadiness?.readiness_score ?? null
  const readinessLevel = summary?.readiness_level  ?? latestReadiness?.level           ?? null
  const sleepScore     = summary?.sleep_score      ?? latestSleep?.sleep_score         ?? null
  const hrvMs          = summary?.hrv_baseline_ms  ?? latestSleep?.avg_overnight_hrv   ?? null
  const sleepDuration  = latestSleep?.total_sleep_minutes ?? null

  const rec = getRecommendation(readinessScore, tomorrowWorkout)

  /* ── Deduplicated trend — first (AM) entry per date ────────────── */

  const dedupedTrend = useMemo(() => {
    const seen = new Map<string, ReadinessTrendPoint>()
    readinessTrend.forEach((r) => {
      if (!seen.has(r.date)) seen.set(r.date, r)
    })
    return Array.from(seen.values())
  }, [readinessTrend])

  /* ── RECOVERY_TREND — last 28 deduped entries, three-line by level ─ */

  const chartTrend = useMemo(() => {
    const window28 = dedupedTrend.slice(-28)
    return window28.map((d) => ({
      date:    fmtDate(d.date),
      hiScore: d.level === "HIGH"     ? (d.readiness_score ?? null) : null,
      mdScore: d.level === "MODERATE" ? (d.readiness_score ?? null) : null,
      loScore: d.level === "LOW"      ? (d.readiness_score ?? null) : null,
    }))
  }, [readinessTrend])

  const trendXInterval = Math.max(1, Math.floor(dedupedTrend.slice(-28).length / 6))

  /* ── CONTRIBUTING_FACTORS — last 14 entries, AM/PM dupes ─── */

  const factors = useMemo((): ReadinessRow[] => {
    const dateCounts: Record<string, number> = {}
    for (const r of readinessTrend) {
      dateCounts[r.date] = (dateCounts[r.date] ?? 0) + 1
    }
    const dateIdx: Record<string, number> = {}
    const labeled: ReadinessRow[] = readinessTrend.map((r) => {
      const idx = dateIdx[r.date] ?? 0
      dateIdx[r.date] = idx + 1
      const amPm =
        (dateCounts[r.date] ?? 1) > 1 ? (idx === 0 ? "AM" : "PM") : null
      return { ...r, amPm }
    })
    return labeled.slice(-14).reverse()
  }, [readinessTrend])

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

      {/* Status bar */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <span className="label-caps text-[var(--teal)]">RECOVERY_SCORE</span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>
        <span className="label-caps" style={{ color: scoreColor(readinessScore) }}>
          {readinessLevel ?? "UNKNOWN"}
        </span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>
        <span className="label-caps text-[var(--on-surface-variant)]">
          {readinessScore != null ? `${readinessScore}/100` : "--"}
        </span>
      </div>

      {/* RECOVERY_STATUS hero */}
      <div
        className="flex items-center gap-8 px-8 py-5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        {/* Arc + score */}
        <div
          className="relative flex items-center justify-center flex-shrink-0"
          style={{ width: 120, height: 120 }}
        >
          <ArcProgress score={readinessScore} level={readinessLevel} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="metric-lg"
              style={{ color: levelColor(readinessLevel), fontSize: 28, lineHeight: 1 }}
            >
              {readinessScore ?? "--"}
            </span>
            <span
              className="label-caps text-[var(--on-surface-variant)]"
              style={{ fontSize: 8, marginTop: 2 }}
            >
              READINESS
            </span>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex gap-8">
          <MiniStat
            label="SLEEP_SCORE"
            value={sleepScore != null ? String(sleepScore) : "--"}
            color={scoreColor(sleepScore)}
          />
          <MiniStat
            label="HRV"
            value={hrvMs != null ? `${Math.round(hrvMs)}` : "--"}
          />
          <MiniStat
            label="SLEEP_DUR"
            value={fmtSleep(sleepDuration)}
          />
        </div>

        {/* System rec message */}
        <div
          className="flex flex-col justify-center flex-1 px-5 py-3 ml-4"
          style={{
            borderLeft: "2px solid var(--outline-variant)",
          }}
        >
          <span
            className="label-caps"
            style={{ fontSize: 8, color: "var(--on-surface-variant)", marginBottom: 4 }}
          >
            SYSTEM_STATUS
          </span>
          <span
            className="label-caps"
            style={{ color: scoreColor(readinessScore), fontSize: 10, letterSpacing: "0.08em" }}
          >
            {systemRec(readinessScore)}
          </span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">

        {/* Left: RECOVERY_TREND + TRAINING_RECOMMENDATION */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: "0 0 63%", borderRight: "1px solid var(--outline-variant)" }}
        >

          {/* RECOVERY_TREND */}
          <div
            className="flex flex-col flex-shrink-0 p-4"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">RECOVERY_TREND</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>● HIGH</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>● MODERATE</span>
                <span className="label-caps" style={{ fontSize: 9, color: "#e05252" }}>● LOW</span>
              </div>
            </div>

            {chartTrend.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartTrend}
                    margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--surface-container-high)"
                      strokeDasharray=""
                      vertical={false}
                    />
                    <ReferenceArea y1={80} y2={100} fill="var(--teal)"  fillOpacity={0.06} />
                    <ReferenceArea y1={60} y2={80}  fill="var(--amber)" fillOpacity={0.06} />
                    <ReferenceArea y1={0}  y2={60}  fill="#e05252"      fillOpacity={0.06} />
                    <XAxis
                      dataKey="date"
                      type="category"
                      interval={trendXInterval}
                      tickFormatter={(val: string) => (val ? val.slice(5) : "")}
                      axisLine={{ stroke: "var(--outline-variant)" }}
                      tickLine={false}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(val) =>
                        String(val).length >= 7 ? String(val).slice(5) : String(val)
                      }
                      formatter={(value, name) =>
                        [
                          String(value),
                          name === "hiScore"
                            ? "HIGH"
                            : name === "mdScore"
                            ? "MODERATE"
                            : "LOW",
                        ] as [string, string]
                      }
                    />
                    <Line
                      dataKey="hiScore"
                      stroke="var(--teal)"
                      strokeWidth={0}
                      dot={{ r: 5, fill: "var(--teal)", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "var(--teal)", strokeWidth: 0 }}
                      isAnimationActive={false}
                      name="hiScore"
                    />
                    <Line
                      dataKey="mdScore"
                      stroke="var(--amber)"
                      strokeWidth={0}
                      dot={{ r: 5, fill: "var(--amber)", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "var(--amber)", strokeWidth: 0 }}
                      isAnimationActive={false}
                      name="mdScore"
                    />
                    <Line
                      dataKey="loScore"
                      stroke="#e05252"
                      strokeWidth={0}
                      dot={{ r: 5, fill: "#e05252", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#e05252", strokeWidth: 0 }}
                      isAnimationActive={false}
                      name="loScore"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData height={220} />
            )}
          </div>

          {/* TRAINING_RECOMMENDATION */}
          <div className="flex flex-col flex-shrink-0 p-4">
            <span className="label-caps text-[var(--on-surface-variant)] mb-3">
              TRAINING_RECOMMENDATION
            </span>

            {tomorrowWorkout ? (
              <div
                className="flex items-start gap-4 p-3 mb-3"
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  border: "1px solid var(--outline-variant)",
                }}
              >
                <div className="flex flex-col">
                  <span
                    className="label-caps text-[var(--on-surface-variant)]"
                    style={{ fontSize: 8 }}
                  >
                    TOMORROW
                  </span>
                  <span
                    className="label-caps text-[var(--on-surface)]"
                    style={{ fontSize: 11, marginTop: 2 }}
                  >
                    {tomorrowWorkout.workout_type}
                    {tomorrowWorkout.target_distance_km != null
                      ? ` — ${tomorrowWorkout.target_distance_km} km`
                      : ""}
                  </span>
                  {tomorrowWorkout.description && (
                    <span
                      className="code-data text-[var(--on-surface-variant)]"
                      style={{ fontSize: 10, marginTop: 2 }}
                    >
                      {tomorrowWorkout.description}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="flex items-center px-3 py-2 mb-3"
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  border: "1px solid var(--outline-variant)",
                }}
              >
                <span
                  className="label-caps text-[var(--on-surface-variant)]"
                  style={{ opacity: 0.5, fontSize: 9 }}
                >
                  NO_WORKOUT_SCHEDULED
                </span>
              </div>
            )}

            <div
              className="flex items-start gap-3 p-3"
              style={{
                backgroundColor: "var(--surface-container-low)",
                borderLeft: `3px solid ${rec.color}`,
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="label-caps" style={{ color: rec.color, fontSize: 10 }}>
                  {rec.action}
                </span>
                <span
                  className="code-data text-[var(--on-surface-variant)]"
                  style={{ fontSize: 11 }}
                >
                  {rec.detail}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: CONTRIBUTING_FACTORS */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface-variant)]">
              CONTRIBUTING_FACTORS
            </span>
            <span
              className="label-caps text-[var(--on-surface-variant)]"
              style={{ opacity: 0.5 }}
            >
              {factors.length} ENTRIES
            </span>
          </div>

          <div
            className="grid px-3 py-1.5 flex-shrink-0"
            style={{
              gridTemplateColumns: "120px 60px 90px 80px 80px 90px",
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {["DATE", "SCORE", "LEVEL", "HRV", "SLEEP", "DOMINANT"].map((col) => (
              <span key={col} className="label-caps text-[var(--on-surface-variant)]">
                {col}
              </span>
            ))}
          </div>

          {factors.length === 0 ? (
            <NoData />
          ) : (
            factors.map((r) => {
              const dom = getDominantFactor(r.hrv_factor_feedback, r.sleep_score_factor_feedback)
              return (
                <div
                  key={`${r.date}-${r.amPm ?? "single"}`}
                  className="grid px-3 py-2 flex-shrink-0"
                  style={{
                    gridTemplateColumns: "120px 60px 90px 80px 80px 90px",
                    borderBottom: "1px solid var(--outline-variant)",
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="code-data text-[var(--on-surface-variant)]"
                      style={{ fontSize: 11 }}
                    >
                      {fmtDate(r.date)}
                    </span>
                    {r.amPm && (
                      <span
                        className="label-caps flex-shrink-0"
                        style={{
                          fontSize: 8,
                          color: "var(--on-surface-variant)",
                          opacity: 0.55,
                        }}
                      >
                        {r.amPm}
                      </span>
                    )}
                  </div>

                  <span
                    className="code-data text-[var(--on-surface)]"
                    style={{ fontSize: 11 }}
                  >
                    {r.readiness_score ?? "--"}
                  </span>

                  <span
                    className="label-caps"
                    style={{ color: levelColor(r.level), fontSize: 9 }}
                  >
                    {r.level ?? "--"}
                  </span>

                  <span
                    className="label-caps"
                    style={{ color: factorStatus(r.hrv_factor_feedback), fontSize: 9 }}
                  >
                    {r.hrv_factor_feedback ?? "--"}
                  </span>

                  <span
                    className="label-caps"
                    style={{ color: factorStatus(r.sleep_score_factor_feedback), fontSize: 9 }}
                  >
                    {r.sleep_score_factor_feedback ?? "--"}
                  </span>

                  <span className="label-caps" style={{ fontSize: 9, color: dom.color }}>
                    {dom.label}
                  </span>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
