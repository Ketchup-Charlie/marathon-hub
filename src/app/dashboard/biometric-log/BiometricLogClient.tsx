"use client"

import React, { useMemo, useEffect } from "react"
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type {
  MetricsSummary,
  HrvTrendPoint,
  SleepTrendPoint,
  ReadinessTrendPoint,
} from "@/lib/hermes"

/* ─── Types ──────────────────────────────────────────────── */

type ReadinessRow = ReadinessTrendPoint & { amPm: string | null }

/* ─── Helpers ────────────────────────────────────────────── */

function fmtSleep(mins: number | null): string {
  if (mins == null) return "--"
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${m}m`
}

function fmtDate(d: string | null | undefined): string {
  return d ? d.split("T")[0] : "--"
}

function levelColor(level: string | null | undefined): string {
  if (level === "HIGH")     return "var(--teal)"
  if (level === "MODERATE") return "var(--amber)"
  if (level === "LOW")      return "#e05252"
  return "var(--on-surface-variant)"
}

function rollingAvg(data: HrvTrendPoint[], window = 7): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null
    const slice = data.slice(i - window + 1, i + 1)
    const vals = slice
      .map((d) => d.avg_overnight_hrv)
      .filter((v): v is number => v != null)
    if (vals.length === 0) return null
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  })
}

/* ─── Stat card ──────────────────────────────────────────── */

function StatCard({
  label,
  value,
  badge,
  badgeColor,
  last,
}: {
  label: string
  value: string
  badge?: string
  badgeColor?: string
  last?: boolean
}) {
  return (
    <div
      className="flex flex-col px-4 py-3 flex-1"
      style={{
        borderRight: last ? undefined : "1px solid var(--outline-variant)",
      }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="metric-lg text-[var(--on-surface)]">{value}</span>
        {badge && (
          <span className="label-caps" style={{ color: badgeColor, fontSize: 9 }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── No data placeholder ────────────────────────────────── */

function NoData({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.35 }}>
        NO_DATA
      </span>
    </div>
  )
}

/* ─── Tooltip style shared ───────────────────────────────── */

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

export default function BiometricLogClient({
  summary,
  hrvTrend,
  sleepTrend,
  readinessTrend,
}: {
  summary:         MetricsSummary | null
  hrvTrend:        HrvTrendPoint[]
  sleepTrend:      SleepTrendPoint[]
  readinessTrend:  ReadinessTrendPoint[]
}) {

  /* ── HRV chart data ─────────────────────────────────────── */

  const chartHrv = useMemo(() => {
    const avgs = rollingAvg(hrvTrend)
    return hrvTrend.map((d, i) => ({
      date:    fmtDate(d.sleep_date ?? d.date),
      hrv:     d.avg_overnight_hrv ?? null,
      rolling: avgs[i],
    }))
  }, [hrvTrend])

  /* ── Debug log ───────────────────────────────────────────── */
  useEffect(() => {
    console.log("[biometric-log] summary:",         summary)
    console.log("[biometric-log] hrvTrend length:", hrvTrend.length, "first:", hrvTrend[0])
    console.log("[biometric-log] sleepTrend:",      sleepTrend.length, "first:", sleepTrend[0])
    console.log("[biometric-log] readinessTrend:",  readinessTrend.length, "first:", readinessTrend[0])
    console.log("[biometric-log] chartHrv[0]:", chartHrv[0])
    console.log("[biometric-log] chartHrv[1]:", chartHrv[1])
    console.log("[biometric-log] chartHrv[2]:", chartHrv[2])
  }, [chartHrv])  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sleep chart data ────────────────────────────────────── */

  const chartSleep = useMemo(() =>
    sleepTrend.map((d) => {
      const deep  = d.deep_sleep_minutes  ?? 0
      const rem   = d.rem_sleep_minutes   ?? 0
      const total = d.total_sleep_minutes ?? 0
      const light = Math.max(0, total - deep - rem)
      return { date: fmtDate(d.sleep_date), deep, rem, light }
    })
  , [sleepTrend])

  const sleepXInterval = Math.max(1, Math.floor(chartSleep.length / 6))

  /* ── Readiness table — last 30 entries, AM/PM for dupes ──── */

  const recentReadiness = useMemo((): ReadinessRow[] => {
    // Count how many times each date appears across full dataset
    const dateCounts: Record<string, number> = {}
    for (const r of readinessTrend) {
      dateCounts[r.date] = (dateCounts[r.date] ?? 0) + 1
    }
    // Assign AM/PM in original order
    const dateIdx: Record<string, number> = {}
    const labeled: ReadinessRow[] = readinessTrend.map((r) => {
      const idx = dateIdx[r.date] ?? 0
      dateIdx[r.date] = idx + 1
      const amPm = (dateCounts[r.date] ?? 1) > 1 ? (idx === 0 ? "AM" : "PM") : null
      return { ...r, amPm }
    })
    return labeled.slice(-30).reverse()
  }, [readinessTrend])

  /* ── Summary stat values ─────────────────────────────────── */

  const latestSleep    = sleepTrend[sleepTrend.length - 1] ?? null
  const sleepScore     = summary?.sleep_score    ?? latestSleep?.sleep_score       ?? null
  const hrvBaseline    = summary?.hrv_baseline_ms ?? latestSleep?.avg_overnight_hrv ?? null
  const readinessScore = summary?.readiness_score ?? null
  const readinessLevel = summary?.readiness_level ?? null
  const sleepDuration  = latestSleep?.total_sleep_minutes ?? null

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

      {/* ── Status bar ──────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <span className="label-caps text-[var(--teal)]">BIOMETRIC_LOG</span>
        <span className="label-caps text-[var(--on-surface-variant)]">::</span>
        <span className="label-caps text-[var(--on-surface-variant)]">84_DAY_WINDOW</span>
      </div>

      {/* ── TOP STAT BAR ────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        <StatCard
          label="SLEEP_SCORE"
          value={sleepScore != null ? String(sleepScore) : "--"}
        />
        <StatCard
          label="HRV"
          value={hrvBaseline != null ? `${Math.round(hrvBaseline)} ms` : "--"}
        />
        <StatCard
          label="READINESS"
          value={readinessScore != null ? String(readinessScore) : "--"}
          badge={readinessLevel ?? undefined}
          badgeColor={readinessLevel ? levelColor(readinessLevel) : undefined}
        />
        <StatCard
          label="SLEEP_DURATION"
          value={fmtSleep(sleepDuration)}
          last
        />
      </div>

      {/* ── Main two-column layout ───────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: charts ──────────────────────────────────── */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: "0 0 63%", borderRight: "1px solid var(--outline-variant)" }}
        >

          {/* HRV_TREND */}
          <div
            className="flex flex-col flex-shrink-0 p-4"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">HRV_TREND</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>
                  ■ DAILY_HRV
                </span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>
                  ┄ 7D_ROLLING_AVG
                </span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)", opacity: 0.5 }}>
                  ┄ HRV_ZONE 44–63ms
                </span>
              </div>
            </div>

            {chartHrv.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartHrv}
                    margin={{ top: 4, right: 8, left: 4, bottom: 20 }}
                  >
                    <CartesianGrid
                      stroke="var(--surface-container-high)"
                      strokeDasharray=""
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      type="category"
                      interval={13}
                      tickFormatter={(val: string) => val ? val.slice(5) : ""}
                      axisLine={{ stroke: "var(--outline-variant)" }}
                      tickLine={false}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tick={{
                        fill: "var(--teal)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(val, payload) => {
                        const d = (payload?.[0]?.payload as { sleep_date?: string })?.sleep_date ?? String(val)
                        return d.length >= 7 ? d.slice(5) : d
                      }}
                      formatter={(value, name) => [
                        `${value} ms`,
                        name === "rolling" ? "7D_AVG" : "HRV",
                      ] as [string, string]}
                    />
                    {/* HRV baseline zone band */}
                    <ReferenceLine
                      y={44}
                      stroke="var(--amber)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                    <ReferenceLine
                      y={63}
                      stroke="var(--amber)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      label={{
                        value: "HRV_ZONE",
                        position: "insideTopRight",
                        fill: "var(--amber)",
                        fontSize: 8,
                        opacity: 0.4,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <Line
                      dataKey="hrv"
                      stroke="var(--teal)"
                      strokeWidth={1}
                      type="linear"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                      name="HRV"
                    />
                    <Line
                      dataKey="rolling"
                      stroke="var(--amber)"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      type="linear"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={true}
                      name="7D_AVG"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData height={220} />
            )}
          </div>

          {/* SLEEP_ANALYSIS */}
          <div className="flex flex-col flex-shrink-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-[var(--on-surface-variant)]">SLEEP_ANALYSIS</span>
              <div className="flex items-center gap-4">
                <span className="label-caps" style={{ fontSize: 9, color: "var(--teal)" }}>■ DEEP</span>
                <span className="label-caps" style={{ fontSize: 9, color: "var(--amber)" }}>■ REM</span>
                <span
                  className="label-caps"
                  style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.6 }}
                >
                  ■ LIGHT
                </span>
              </div>
            </div>

            {chartSleep.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartSleep}
                    margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
                    barCategoryGap="8%"
                  >
                    <CartesianGrid
                      stroke="var(--surface-container-high)"
                      strokeDasharray=""
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      type="category"
                      interval={sleepXInterval}
                      axisLine={{ stroke: "var(--outline-variant)" }}
                      tickLine={false}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                      tickFormatter={(v: number) => `${v}m`}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }}
                      formatter={(value, name) => [
                        `${value} min`,
                        String(name).toUpperCase(),
                      ] as [string, string]}
                    />
                    <Bar dataKey="deep"  stackId="s" fill="var(--teal)"                      isAnimationActive={false} name="deep"  />
                    <Bar dataKey="rem"   stackId="s" fill="var(--amber)"                     isAnimationActive={false} name="rem"   />
                    <Bar dataKey="light" stackId="s" fill="#6b7280"                          isAnimationActive={false} name="light" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoData height={220} />
            )}
          </div>

        </div>

        {/* ── Right: readiness log ───────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

          {/* Section header */}
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface-variant)]">READINESS_LOG</span>
            <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.5 }}>
              {recentReadiness.length} ENTRIES
            </span>
          </div>

          {/* Column headers */}
          <div
            className="grid px-3 py-1.5 flex-shrink-0"
            style={{
              gridTemplateColumns: "108px 56px 80px 1fr 1fr",
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {["DATE", "SCORE", "LEVEL", "HRV_FACTOR", "SLEEP_FACTOR"].map((col) => (
              <span key={col} className="label-caps text-[var(--on-surface-variant)]">{col}</span>
            ))}
          </div>

          {recentReadiness.length === 0 ? (
            <NoData />
          ) : (
            recentReadiness.map((r) => (
              <div
                key={`${r.date}-${r.amPm ?? "single"}`}
                className="grid px-3 py-2 flex-shrink-0"
                style={{
                  gridTemplateColumns: "108px 56px 80px 1fr 1fr",
                  borderBottom: "1px solid var(--outline-variant)",
                }}
              >
                {/* Date + AM/PM */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>
                    {fmtDate(r.date)}
                  </span>
                  {r.amPm && (
                    <span
                      className="label-caps flex-shrink-0"
                      style={{ fontSize: 8, color: "var(--on-surface-variant)", opacity: 0.55 }}
                    >
                      {r.amPm}
                    </span>
                  )}
                </div>

                {/* Score with inline bar */}
                <div className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: 24,
                      height: 3,
                      backgroundColor: "var(--surface-container-high)",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, r.readiness_score ?? 0)}%`,
                        backgroundColor: levelColor(r.level),
                      }}
                    />
                  </div>
                  <span className="code-data text-[var(--on-surface)]" style={{ fontSize: 11 }}>
                    {r.readiness_score ?? "--"}
                  </span>
                </div>

                <span className="label-caps" style={{ color: levelColor(r.level), fontSize: 9 }}>
                  {r.level ?? "--"}
                </span>

                <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>
                  {r.hrv_factor_feedback ?? "--"}
                </span>

                <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>
                  {r.sleep_score_factor_feedback ?? "--"}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
