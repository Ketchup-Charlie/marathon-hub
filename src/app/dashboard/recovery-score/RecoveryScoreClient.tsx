"use client"

import React, { useMemo } from "react"
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type {
  MetricsSummary,
  ReadinessTrendPoint,
  SleepTrendPoint,
  HrvTrendPoint,
  TrainingLoadPoint,
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
  if (lower.includes("poor"))                                                             return 0
  if (lower.includes("low") || lower.includes("limit") || lower.includes("impair"))      return 1
  if (lower.includes("moderate") || lower.includes("caution"))                           return 2
  if (lower.includes("good") || lower.includes("optimal") || lower.includes("support"))  return 3
  return 99
}

function getDominantFactor(
  hrv:   string | null | undefined,
  sleep: string | null | undefined,
): { label: string; color: string } {
  const hr = feedbackRank(hrv)
  const sr = feedbackRank(sleep)
  if (hr === 3 && sr === 3) return { label: "OPTIMAL",  color: "var(--teal)" }
  if (hr === sr)            return { label: "BALANCED",  color: "var(--on-surface-variant)" }
  if (hr < sr)              return { label: "HRV",       color: "#e05252" }
  return                           { label: "SLEEP",     color: "#e05252" }
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

function systemRec(level: string | null | undefined): string {
  if (level === "HIGH")     return "SYSTEM_OPTIMAL :: FULL_TRAINING_LOAD_AUTHORIZED"
  if (level === "MODERATE") return "SYSTEM_NOMINAL :: PROCEED_WITH_CAUTION"
  if (level === "LOW")      return "SYSTEM_DEGRADED :: REDUCE_INTENSITY"
  if (level === "POOR")     return "SYSTEM_CRITICAL :: REST_DAY_RECOMMENDED"
  return "AWAITING_BIOMETRIC_DATA"
}

function getRecommendation(
  level: string | null | undefined,
  workout: TomorrowWorkout,
): { action: string; detail: string; color: string } {
  if (level === "HIGH") {
    return {
      action: "AUTHORIZED",
      detail: workout
        ? `Execute ${workout.workout_type}${workout.target_distance_km ? ` — ${workout.target_distance_km} km` : ""} as scheduled.`
        : "No workout scheduled. Light activity permitted.",
      color: "var(--teal)",
    }
  }
  if (level === "MODERATE") {
    return {
      action: "CAUTION",
      detail: workout
        ? `Reduce intensity 15–20%. ${workout.workout_type} at modified effort.`
        : "Monitor response. Keep effort aerobic.",
      color: "var(--amber)",
    }
  }
  if (level === "LOW") {
    const isHard =
      workout != null &&
      ["INTERVAL", "TEMPO", "RACE_PACE", "THRESHOLD"].includes(workout.workout_type.toUpperCase())
    return {
      action: isHard ? "DOWNGRADE" : "REDUCE",
      detail: isHard
        ? `${workout!.workout_type} → replace with EASY. Recovery indicators insufficient for high-intensity load.`
        : workout
          ? `Complete ${workout.workout_type} at reduced effort. Monitor response closely.`
          : "Keep effort easy. Monitor fatigue response.",
      color: "#e05252",
    }
  }
  if (level === "POOR") {
    return {
      action: "REST_DAY",
      detail: "Physiological markers indicate recovery deficit. Postpone structured training.",
      color: "#e05252",
    }
  }
  return {
    action: "NO_DATA",
    detail: "Cannot assess without biometric data.",
    color: "var(--on-surface-variant)",
  }
}

function acwrColor(ratio: number | null): string {
  if (ratio == null) return "var(--on-surface-variant)"
  if (ratio >= 0.8 && ratio <= 1.3) return "#22c55e"
  if (ratio >= 0.6 && ratio < 0.8)  return "var(--amber)"
  return "#e05252"
}

function acwrLabel(ratio: number | null): string {
  if (ratio == null) return "NO_DATA"
  if (ratio >= 0.8 && ratio <= 1.3) return "OPTIMAL"
  if (ratio > 1.3)                   return "HIGH_RISK"
  if (ratio >= 0.6)                  return "LOW"
  return "VERY_LOW"
}

function rollingAvg(data: HrvTrendPoint[], window = 7): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null
    const slice = data.slice(i - window + 1, i + 1)
    const vals = slice.map((d) => d.avg_overnight_hrv).filter((v): v is number => v != null)
    if (vals.length === 0) return null
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  })
}

/* ─── ArcProgress ────────────────────────────────────────── */

function ArcProgress({ score, level }: { score: number | null; level: string | null | undefined }) {
  const size   = 120
  const stroke = 8
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const pct    = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0
  const offset = circ * (1 - pct)
  const color  = levelColor(level)

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-container-high)" strokeWidth={stroke} />
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

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>{label}</span>
      <span className="metric-lg" style={{ color: color ?? "var(--on-surface)", fontSize: 20 }}>{value}</span>
    </div>
  )
}

/* ─── NoData ─────────────────────────────────────────────── */

function NoData({ height = 180 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.35 }}>NO_DATA</span>
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

const tickStyle = {
  fill: "var(--on-surface-variant)",
  fontSize: 9,
  fontFamily: "var(--font-space-grotesk)",
}

/* ─── Main component ─────────────────────────────────────── */

export default function RecoveryScoreClient({
  summary,
  readinessTrend,
  sleepTrend,
  hrvTrend,
  trainingLoadTrend,
  tomorrowWorkout,
}: {
  summary:             MetricsSummary | null
  readinessTrend:      ReadinessTrendPoint[]
  sleepTrend:          SleepTrendPoint[]
  hrvTrend:            HrvTrendPoint[]
  trainingLoadTrend:   TrainingLoadPoint[]
  tomorrowWorkout:     TomorrowWorkout
}) {
  const latestReadiness = readinessTrend[readinessTrend.length - 1] ?? null
  const latestSleep     = sleepTrend[sleepTrend.length - 1]         ?? null

  const readinessScore = summary?.readiness_score ?? latestReadiness?.readiness_score ?? null
  const readinessLevel = summary?.readiness_level ?? latestReadiness?.level           ?? null
  const sleepScore     = summary?.sleep_score     ?? latestSleep?.sleep_score         ?? null
  const hrvMs          = summary?.hrv_baseline_ms ?? latestSleep?.avg_overnight_hrv   ?? null
  const sleepDuration  = latestSleep?.total_sleep_minutes ?? null

  const rec = getRecommendation(readinessLevel, tomorrowWorkout)

  /* ── RECOVERY_TREND ─────────────────────────────────────── */

  const chartTrend = useMemo(() => {
    const window28 = readinessTrend.slice(-28)
    return window28.map((d) => ({
      date:    fmtDate(d.date),
      hiScore: d.level === "HIGH"     ? (d.readiness_score ?? null) : null,
      mdScore: d.level === "MODERATE" ? (d.readiness_score ?? null) : null,
      loScore: d.level === "LOW"      ? (d.readiness_score ?? null) : null,
    }))
  }, [readinessTrend])

  const trendXInterval = Math.max(1, Math.floor(chartTrend.length / 6))

  /* ── HRV_TREND ──────────────────────────────────────────── */

  const hrv28 = useMemo(() => hrvTrend.slice(-28), [hrvTrend])

  const chartHrv = useMemo(() => {
    const avgs = rollingAvg(hrv28)
    return hrv28.map((d, i) => ({
      date:    fmtDate(d.sleep_date ?? d.date),
      hrv:     d.avg_overnight_hrv ?? null,
      rolling: avgs[i],
    }))
  }, [hrv28])

  const hrvXInterval = Math.max(1, Math.floor(chartHrv.length / 6))

  /* ── SLEEP_ANALYSIS ─────────────────────────────────────── */

  const chartSleep = useMemo(() =>
    sleepTrend.slice(-28).map((d) => {
      const deep  = d.deep_sleep_minutes  ?? 0
      const rem   = d.rem_sleep_minutes   ?? 0
      const total = d.total_sleep_minutes ?? 0
      const light = Math.max(0, total - deep - rem)
      return { date: fmtDate(d.sleep_date), deep, rem, light }
    })
  , [sleepTrend])

  const sleepXInterval = Math.max(1, Math.floor(chartSleep.length / 6))

  /* ── TRAINING_LOAD ──────────────────────────────────────── */

  const chartLoad = useMemo(() =>
    trainingLoadTrend.slice(-28).map((d) => ({
      date:    d.date,
      acute:   d.acute_load   ?? null,
      chronic: d.chronic_load ?? null,
      ratio:   d.load_ratio   ?? null,
    }))
  , [trainingLoadTrend])

  const loadXInterval = Math.max(1, Math.floor(chartLoad.length / 6))
  const currentAcwr   = chartLoad[chartLoad.length - 1]?.ratio ?? null

  /* ── CONTRIBUTING_FACTORS ───────────────────────────────── */

  const factors = useMemo((): ReadinessRow[] => {
    const dateCounts: Record<string, number> = {}
    for (const r of readinessTrend) dateCounts[r.date] = (dateCounts[r.date] ?? 0) + 1
    const dateIdx: Record<string, number> = {}
    const labeled: ReadinessRow[] = readinessTrend.map((r) => {
      const idx = dateIdx[r.date] ?? 0
      dateIdx[r.date] = idx + 1
      const amPm = (dateCounts[r.date] ?? 1) > 1 ? (idx === 0 ? "AM" : "PM") : null
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
        style={{ height: 36, backgroundColor: "var(--surface-container-low)", borderBottom: "1px solid var(--outline-variant)" }}
      >
        <span className="label-caps text-[var(--teal)]">HEALTH</span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>
        <span className="label-caps" style={{ color: scoreColor(readinessScore) }}>{readinessLevel ?? "UNKNOWN"}</span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>
        <span className="label-caps text-[var(--on-surface-variant)]">
          {readinessScore != null ? `${readinessScore}/100` : "--"}
        </span>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: HERO + 4 stacked charts */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: "0 0 65%", borderRight: "1px solid var(--outline-variant)" }}
        >

          {/* HERO */}
          <div
            className="flex items-center gap-8 px-8 py-5 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            {/* Arc gauge */}
            <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 120, height: 120 }}>
              <ArcProgress score={readinessScore} level={readinessLevel} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="metric-lg" style={{ color: levelColor(readinessLevel), fontSize: 28, lineHeight: 1 }}>
                  {readinessScore ?? "--"}
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8, marginTop: 2 }}>READINESS</span>
              </div>
            </div>

            {/* Mini stats */}
            <div className="flex gap-8">
              <MiniStat label="SLEEP_SCORE" value={sleepScore != null ? String(sleepScore) : "--"} color={scoreColor(sleepScore)} />
              <MiniStat label="HRV"         value={hrvMs != null ? `${Math.round(hrvMs)}` : "--"} />
              <MiniStat label="SLEEP_DUR"   value={fmtSleep(sleepDuration)} />
            </div>

            {/* System status */}
            <div
              className="flex flex-col justify-center flex-1 px-5 py-3 ml-4"
              style={{ borderLeft: "2px solid var(--outline-variant)" }}
            >
              <span className="label-caps" style={{ fontSize: 8, color: "var(--on-surface-variant)", marginBottom: 4 }}>SYSTEM_STATUS</span>
              <span className="label-caps" style={{ color: levelColor(readinessLevel), fontSize: 10, letterSpacing: "0.08em" }}>
                {systemRec(readinessLevel)}
              </span>
            </div>
          </div>

          {/* RECOVERY_TREND */}
          <div className="flex flex-col flex-shrink-0 p-4" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">RECOVERY_TREND</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>● HIGH</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>● MODERATE</span>
                <span className="label-caps" style={{ fontSize: 9, color: "#e05252" }}>● LOW</span>
              </div>
            </div>
            {chartTrend.length > 0 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartTrend} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--surface-container-high)" strokeDasharray="" vertical={false} />
                    <ReferenceArea y1={80} y2={100} fill="var(--teal)"  fillOpacity={0.06} />
                    <ReferenceArea y1={60} y2={80}  fill="var(--amber)" fillOpacity={0.06} />
                    <ReferenceArea y1={0}  y2={60}  fill="#e05252"      fillOpacity={0.06} />
                    <XAxis dataKey="date" type="category" interval={trendXInterval} tickFormatter={(v: string) => v ? v.slice(5) : ""} axisLine={{ stroke: "var(--outline-variant)" }} tickLine={false} tick={tickStyle} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={32} tick={tickStyle} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(val) => String(val).length >= 7 ? String(val).slice(5) : String(val)}
                      formatter={(value, name) => [String(value), name === "hiScore" ? "HIGH" : name === "mdScore" ? "MODERATE" : "LOW"] as [string, string]}
                    />
                    <Line dataKey="hiScore" stroke="var(--teal)"  strokeWidth={0} dot={{ r: 5, fill: "var(--teal)",  strokeWidth: 0 }} activeDot={{ r: 6, fill: "var(--teal)",  strokeWidth: 0 }} isAnimationActive={false} name="hiScore" />
                    <Line dataKey="mdScore" stroke="var(--amber)" strokeWidth={0} dot={{ r: 5, fill: "var(--amber)", strokeWidth: 0 }} activeDot={{ r: 6, fill: "var(--amber)", strokeWidth: 0 }} isAnimationActive={false} name="mdScore" />
                    <Line dataKey="loScore" stroke="#e05252"      strokeWidth={0} dot={{ r: 5, fill: "#e05252",      strokeWidth: 0 }} activeDot={{ r: 6, fill: "#e05252",      strokeWidth: 0 }} isAnimationActive={false} name="loScore" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData />
            )}
          </div>

          {/* HRV_TREND */}
          <div className="flex flex-col flex-shrink-0 p-4" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">HRV_TREND</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>■ DAILY_HRV</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>┄ 7D_ROLLING_AVG</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)", opacity: 0.5 }}>┄ HRV_ZONE 44–63ms</span>
              </div>
            </div>
            {chartHrv.length > 0 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartHrv} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--surface-container-high)" strokeDasharray="" vertical={false} />
                    <XAxis dataKey="date" type="category" interval={hrvXInterval} tickFormatter={(v: string) => v ? v.slice(5) : ""} axisLine={{ stroke: "var(--outline-variant)" }} tickLine={false} tick={tickStyle} />
                    <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} width={36} tick={{ ...tickStyle, fill: "var(--teal)" }} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(val) => String(val).length >= 7 ? String(val).slice(5) : String(val)}
                      formatter={(value, name) => [`${value} ms`, name === "rolling" ? "7D_AVG" : "HRV"] as [string, string]}
                    />
                    <ReferenceLine y={44} stroke="var(--amber)" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <ReferenceLine
                      y={63}
                      stroke="var(--amber)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      label={{ value: "HRV_ZONE", position: "insideTopRight", fill: "var(--amber)", fontSize: 8, opacity: 0.4, fontFamily: "var(--font-space-grotesk)" }}
                    />
                    <Line dataKey="hrv"     stroke="var(--teal)"  strokeWidth={1}   type="linear" dot={false} isAnimationActive={false} connectNulls={false} name="HRV" />
                    <Line dataKey="rolling" stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="5 3" type="linear" dot={false} isAnimationActive={false} connectNulls={true} name="7D_AVG" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData />
            )}
          </div>

          {/* SLEEP_ANALYSIS */}
          <div className="flex flex-col flex-shrink-0 p-4" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">SLEEP_ANALYSIS</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>■ DEEP</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>■ REM</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.6 }}>■ LIGHT</span>
              </div>
            </div>
            {chartSleep.length > 0 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartSleep} margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barCategoryGap="8%">
                    <CartesianGrid stroke="var(--surface-container-high)" strokeDasharray="" vertical={false} />
                    <XAxis dataKey="date" type="category" interval={sleepXInterval} axisLine={{ stroke: "var(--outline-variant)" }} tickLine={false} tick={tickStyle} />
                    <YAxis axisLine={false} tickLine={false} width={40} tick={tickStyle} tickFormatter={(v: number) => `${v}m`} />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }}
                      formatter={(value, name) => [`${value} min`, String(name).toUpperCase()] as [string, string]}
                    />
                    <Bar dataKey="deep"  stackId="s" fill="var(--teal)"  isAnimationActive={false} name="deep"  />
                    <Bar dataKey="rem"   stackId="s" fill="var(--amber)" isAnimationActive={false} name="rem"   />
                    <Bar dataKey="light" stackId="s" fill="#6b7280"      isAnimationActive={false} name="light" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData />
            )}
          </div>

          {/* TRAINING_LOAD */}
          <div className="flex flex-col flex-shrink-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="label-caps text-[var(--on-surface-variant)]">TRAINING_LOAD</span>
                {currentAcwr != null && (
                  <span
                    className="label-caps"
                    style={{ fontSize: 9, color: acwrColor(currentAcwr), border: `1px solid ${acwrColor(currentAcwr)}`, padding: "1px 5px", opacity: 0.9 }}
                  >
                    ACWR: {currentAcwr.toFixed(2)} {acwrLabel(currentAcwr)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>■ ACUTE</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>┄ CHRONIC</span>
                <span className="label-caps" style={{ fontSize: 9, color: acwrColor(currentAcwr) }}>◦ ACWR</span>
              </div>
            </div>
            {chartLoad.length > 0 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartLoad} margin={{ top: 4, right: 44, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--surface-container-high)" strokeDasharray="" vertical={false} />
                    <XAxis dataKey="date" type="category" interval={loadXInterval} tickFormatter={(v: string) => v ? v.slice(5) : ""} axisLine={{ stroke: "var(--outline-variant)" }} tickLine={false} tick={tickStyle} />
                    <YAxis yAxisId="left"  domain={["auto", "auto"]} axisLine={false} tickLine={false} width={36} tick={tickStyle} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 2.0]} axisLine={false} tickLine={false} width={36} tick={{ ...tickStyle, fill: acwrColor(currentAcwr) }} tickFormatter={(v: number) => v.toFixed(1)} ticks={[0, 0.5, 1.0, 1.5, 2.0]} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(val) => String(val).length >= 7 ? String(val).slice(5) : String(val)}
                      formatter={(value, name) => {
                        if (name === "ratio") return [Number(value).toFixed(2), "ACWR"] as [string, string]
                        return [String(value), name === "acute" ? "ACUTE_LOAD" : "CHRONIC_LOAD"] as [string, string]
                      }}
                    />
                    <ReferenceLine yAxisId="right" y={0.8} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <ReferenceLine yAxisId="right" y={1.3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: "OPTIMAL_ZONE", position: "insideTopRight", fill: "#22c55e", fontSize: 8, opacity: 0.5, fontFamily: "var(--font-space-grotesk)" }}
                    />
                    <Line yAxisId="left"  dataKey="acute"   stroke="var(--teal)"          strokeWidth={1.5} type="linear" dot={false} isAnimationActive={false} connectNulls={true} name="acute" />
                    <Line yAxisId="left"  dataKey="chronic" stroke="var(--amber)"          strokeWidth={1.5} strokeDasharray="5 3" type="linear" dot={false} isAnimationActive={false} connectNulls={true} name="chronic" />
                    <Line yAxisId="right" dataKey="ratio"   stroke={acwrColor(currentAcwr)} strokeWidth={1}   type="linear" dot={false} isAnimationActive={false} connectNulls={true} name="ratio" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData />
            )}
          </div>

        </div>

        {/* RIGHT: Training Rec + Contributing Factors */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

          {/* TRAINING_RECOMMENDATION */}
          <div className="flex flex-col flex-shrink-0 p-4" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <span className="label-caps text-[var(--on-surface-variant)] mb-3">TRAINING_RECOMMENDATION</span>

            {tomorrowWorkout ? (
              <div
                className="flex items-start gap-4 p-3 mb-3"
                style={{ backgroundColor: "var(--surface-container-low)", border: "1px solid var(--outline-variant)" }}
              >
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 8 }}>TOMORROW</span>
                  <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 11, marginTop: 2 }}>
                    {tomorrowWorkout.workout_type}
                    {tomorrowWorkout.target_distance_km != null ? ` — ${tomorrowWorkout.target_distance_km} km` : ""}
                  </span>
                  {tomorrowWorkout.description && (
                    <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 10, marginTop: 2 }}>
                      {tomorrowWorkout.description}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="flex items-center px-3 py-2 mb-3"
                style={{ backgroundColor: "var(--surface-container-low)", border: "1px solid var(--outline-variant)" }}
              >
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.5, fontSize: 9 }}>
                  NO_WORKOUT_SCHEDULED
                </span>
              </div>
            )}

            <div
              className="flex items-start gap-3 p-3"
              style={{ backgroundColor: "var(--surface-container-low)", borderLeft: `3px solid ${rec.color}` }}
            >
              <div className="flex flex-col gap-1">
                <span className="label-caps" style={{ color: rec.color, fontSize: 10 }}>{rec.action}</span>
                <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>{rec.detail}</span>
              </div>
            </div>
          </div>

          {/* CONTRIBUTING_FACTORS header */}
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)", backgroundColor: "var(--surface-container-low)" }}
          >
            <span className="label-caps text-[var(--on-surface-variant)]">CONTRIBUTING_FACTORS</span>
            <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.5 }}>{factors.length} ENTRIES</span>
          </div>

          {/* Column headers */}
          <div
            className="grid px-3 py-1.5 flex-shrink-0"
            style={{
              gridTemplateColumns: "110px 54px 80px 70px 70px 70px",
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {["DATE", "SCORE", "LEVEL", "HRV", "SLEEP", "DOMINANT"].map((col) => (
              <span key={col} className="label-caps text-[var(--on-surface-variant)]">{col}</span>
            ))}
          </div>

          {factors.length === 0 ? (
            <NoData height={200} />
          ) : (
            factors.map((r) => {
              const dom = getDominantFactor(r.hrv_factor_feedback, r.sleep_score_factor_feedback)
              return (
                <div
                  key={`${r.date}-${r.amPm ?? "single"}`}
                  className="grid px-3 py-2 flex-shrink-0"
                  style={{ gridTemplateColumns: "110px 54px 80px 70px 70px 70px", borderBottom: "1px solid var(--outline-variant)" }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>{fmtDate(r.date)}</span>
                    {r.amPm && (
                      <span className="label-caps flex-shrink-0" style={{ fontSize: 8, color: "var(--on-surface-variant)", opacity: 0.55 }}>
                        {r.amPm}
                      </span>
                    )}
                  </div>
                  <span className="code-data text-[var(--on-surface)]" style={{ fontSize: 11 }}>{r.readiness_score ?? "--"}</span>
                  <span className="label-caps" style={{ color: levelColor(r.level), fontSize: 9 }}>{r.level ?? "--"}</span>
                  <span className="label-caps" style={{ color: factorStatus(r.hrv_factor_feedback), fontSize: 9 }}>{r.hrv_factor_feedback ?? "--"}</span>
                  <span className="label-caps" style={{ color: factorStatus(r.sleep_score_factor_feedback), fontSize: 9 }}>{r.sleep_score_factor_feedback ?? "--"}</span>
                  <span className="label-caps" style={{ fontSize: 9, color: dom.color }}>{dom.label}</span>
                </div>
              )
            })
          )}

        </div>
      </div>
    </div>
  )
}
