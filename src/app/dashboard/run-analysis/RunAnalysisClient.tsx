"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { fmtPace } from "@/lib/pace"

/* ─── Types ──────────────────────────────────────────────── */

export type RunDetail = {
  id: string
  date: string
  title: string | null
  run_type_tag: string | null
  total_distance: number | null
  total_time: string | null
  avg_pace: string | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  avg_gct: number | null
  avg_vertical_oscillation: number | null
  notes: string | null
}

export type Lap = {
  lap_number: number
  lap_intent: string | null
  distance: number | null
  time: string | null
  avg_pace: string | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  avg_gct: number | null
  avg_stride_length: number | null
  avg_vertical_oscillation: number | null
}

export type TimePoint = {
  seconds_elapsed: number
  distance_km: number | null
  pace_sec_per_km: number | null
  hr: number | null
  cadence: number | null
  elevation_m: number | null
}

/* ─── Helpers ────────────────────────────────────────────── */

function fmtDist(km: number | null): string {
  if (km == null) return "--"
  return `${km.toFixed(2)} km`
}

function fmtGct(ms: number | null): string {
  if (ms == null) return "--"
  return `${Math.round(ms)} ms`
}

/* ─── Stat box ───────────────────────────────────────────── */

function StatBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      className="flex flex-col items-start px-4 py-2.5"
      style={{ border: "1px solid var(--outline-variant)", minWidth: 110 }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{label}</span>
      <span className="metric-lg text-[var(--on-surface)] mt-0.5">{value ?? "--"}</span>
    </div>
  )
}

/* ─── Progress bar ───────────────────────────────────────── */

function MetricBar({
  value,
  rangeMin,
  rangeMax,
  targetMin,
  targetMax,
  warnAbove,
}: {
  value: number | null
  rangeMin: number
  rangeMax: number
  targetMin: number
  targetMax: number
  warnAbove?: number
}) {
  if (value == null) {
    return <div style={{ height: 3, backgroundColor: "var(--surface-container-high)" }} />
  }
  const pct     = Math.min(100, Math.max(0, ((value - rangeMin) / (rangeMax - rangeMin)) * 100))
  const isWarn  = warnAbove != null && value > warnAbove
  const inRange = value >= targetMin && value <= targetMax
  const color   = isWarn ? "#e05252" : inRange ? "var(--teal)" : "var(--amber)"
  return (
    <div style={{ height: 3, backgroundColor: "var(--surface-container-high)" }}>
      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

/* ─── Chart tooltip ──────────────────────────────────────── */

function ChartTooltip({
  active,
  payload,
  label,
  xMode,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | null; color: string }>
  label?: number
  xMode: "time" | "dist"
}) {
  if (!active || !payload?.length) return null

  let xLabel: string
  if (xMode === "time") {
    const totalSec = Math.round((label ?? 0) * 60)
    const mm = Math.floor(totalSec / 60)
    const ss = String(totalSec % 60).padStart(2, "0")
    xLabel = `${mm}:${ss}`
  } else {
    xLabel = `${(label ?? 0).toFixed(2)} km`
  }

  return (
    <div
      className="flex flex-col gap-0.5 px-2.5 py-2"
      style={{
        backgroundColor: "var(--surface-container-high)",
        border: "1px solid var(--outline-variant)",
      }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{xLabel}</span>
      {payload.map((entry) =>
        entry.value != null ? (
          <span key={entry.dataKey} className="code-data" style={{ color: entry.color }}>
            {entry.dataKey === "pace"
              ? `PACE: ${fmtPace(entry.value)}/km`
              : entry.dataKey === "hr"
              ? `HR: ${entry.value} bpm`
              : entry.dataKey === "cad"
              ? `CAD: ${entry.value} spm`
              : `ELEV: ${entry.value.toFixed(0)} m`}
          </span>
        ) : null
      )}
    </div>
  )
}

/* ─── Legend button ──────────────────────────────────────── */

function LegendBtn({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="label-caps transition-colors"
      style={{
        padding: "2px 8px",
        fontSize: 9,
        border: `1px solid ${active ? color : "var(--outline-variant)"}`,
        color: active ? color : "var(--on-surface-variant)",
      }}
    >
      {label}
    </button>
  )
}

/* ─── Lap filter button ──────────────────────────────────── */

type LapFilter = "ALL" | "WARM_UP" | "RUN" | "INTERVAL" | "RECOVERY"

function LapFilterBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="label-caps transition-colors"
      style={{
        padding: "2px 8px",
        fontSize: 9,
        border: `1px solid ${active ? "var(--teal)" : "var(--outline-variant)"}`,
        color: active ? "var(--teal)" : "var(--on-surface-variant)",
      }}
    >
      {label}
    </button>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function RunAnalysisClient({
  run,
  laps,
  timeseries,
}: {
  run: RunDetail
  laps: Lap[]
  timeseries: TimePoint[]
}) {
  const [showHR,   setShowHR]   = useState(true)
  const [showCad,  setShowCad]  = useState(false)
  const [showElev, setShowElev] = useState(false)
  const [xMode,    setXMode]    = useState<"time" | "dist">("time")
  const [lapFilter, setLapFilter] = useState<LapFilter>("ALL")

  /* ── Derived values ───────────────────────────────────────── */

  const strideLaps = laps.filter((l) => l.avg_stride_length != null)
  const avgStride  = strideLaps.length > 0
    ? strideLaps.reduce((s, l) => s + l.avg_stride_length!, 0) / strideLaps.length
    : null

  const vertRatio =
    run.avg_vertical_oscillation != null && avgStride != null && avgStride > 0
      ? run.avg_vertical_oscillation / avgStride
      : null

  /* ── Debug: log raw values so we can verify units ─────────── */
  useEffect(() => {
    console.log("[run-detail] avg_vertical_oscillation raw:", run.avg_vertical_oscillation)
    console.log("[run-detail] avgStride computed:", avgStride)
    console.log("[run-detail] vertRatio computed:", vertRatio)
  }, [run.avg_vertical_oscillation, avgStride, vertRatio])

  /* ── Chart data ─────────────────────────────────────────── */

  const chartData = timeseries.map((pt) => ({
    minutes:  +(pt.seconds_elapsed / 60).toFixed(2),
    distance: pt.distance_km,
    pace: pt.pace_sec_per_km != null && pt.pace_sec_per_km >= 150 && pt.pace_sec_per_km <= 900
      ? pt.pace_sec_per_km : null,
    hr:   pt.hr != null && pt.hr >= 30 && pt.hr <= 250 ? pt.hr : null,
    cad:  pt.cadence != null && pt.cadence >= 100 && pt.cadence <= 250 ? pt.cadence : null,
    elev: pt.elevation_m,
  }))

  const hasChart    = chartData.some((d) => d.pace != null)
  const hasElevData = chartData.some((d) => d.elev != null)
  const xKey        = xMode === "time" ? "minutes" : "distance"
  const xTickFmt    = xMode === "time"
    ? (v: number) => `${Math.floor(v)}m`
    : (v: number) => `${v.toFixed(1)}k`

  // Minimal right margin—axes handle their own spacing via width property
  const chartMarginRight = 4

  /* ── Lap table ──────────────────────────────────────────── */

  const intentSet = new Set(laps.map((l) => l.lap_intent ?? "Run"))
  const singleIntent  = intentSet.size <= 1
  const showLapTable  = laps.length > 0

  const intentToFilter: Record<LapFilter, string | null> = {
    ALL: null,
    WARM_UP:  "Warm Up",
    RUN:      "Run",
    INTERVAL: "Interval",
    RECOVERY: "Recovery",
  }
  const filteredLaps = lapFilter === "ALL"
    ? laps
    : laps.filter((l) => (l.lap_intent ?? "Run") === intentToFilter[lapFilter])

  /* ── System critique ─────────────────────────────────────── */

  const flags: string[] = []
  if (run.avg_gct != null && run.avg_gct > 280)
    flags.push(`GCT_ELEVATED: avg ${Math.round(run.avg_gct)}ms — target <280ms`)
  if (run.avg_cadence != null && run.avg_cadence < 170)
    flags.push(`CADENCE_LOW: ${run.avg_cadence}spm — target 170-175`)
  if ((run.run_type_tag ?? "").toLowerCase().includes("easy") && run.avg_hr != null && run.avg_hr > 140)
    flags.push(`HR_DRIFT: avg HR ${run.avg_hr}bpm exceeds Z2 ceiling`)
  if (vertRatio != null && vertRatio > 9)
    flags.push(`VERTICAL_RATIO_HIGH: ${vertRatio.toFixed(1)}% — target <9%`)
  if (flags.length === 0)
    flags.push("FORM_OPTIMAL: no flags detected")

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

      {/* ── Status bar ──────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="label-caps text-[var(--teal)]">RUN_ANALYSIS</span>
          <span className="label-caps text-[var(--on-surface-variant)]">::</span>
          <span className="label-caps text-[var(--on-surface)]">{run.date}</span>
          {run.run_type_tag && (
            <span className="label-caps text-[var(--on-surface-variant)]">{run.run_type_tag}</span>
          )}
        </div>
        <Link
          href="/dashboard/run-analysis"
          className="label-caps px-3 py-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
          style={{ border: "1px solid var(--outline-variant)", textDecoration: "none" }}
        >
          ← LOG
        </Link>
      </div>

      {/* ── Session header ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ paddingTop: 18, paddingBottom: 18, borderBottom: "1px solid var(--outline-variant)" }}
      >
        <div className="flex flex-col gap-2 min-w-0">
          <h1
            className="text-[var(--on-surface)] font-semibold truncate"
            style={{ fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {run.title ?? run.run_type_tag ?? "UNTITLED_RUN"}
          </h1>
          <span className="label-caps text-[var(--on-surface-variant)]">{run.date}</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-6">
          <StatBox label="DISTANCE" value={fmtDist(run.total_distance)} />
          <StatBox label="AVG_PACE"  value={run.avg_pace} />
          <StatBox label="AVG_HR"    value={run.avg_hr != null ? `${run.avg_hr} bpm` : null} />
          <StatBox label="DURATION"  value={run.total_time} />
        </div>
      </div>

      {/* ── Main two-column layout ───────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left column (70%) ─────────────────────────────── */}
        <div
          className="flex flex-col min-w-0 overflow-y-auto"
          style={{ flex: "0 0 70%", borderRight: "1px solid var(--outline-variant)" }}
        >

          {/* TIME_SERIES_ANALYSIS */}
          <div
            className="flex flex-col p-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            {/* Header row: section label + legend toggles */}
            <div className="flex items-center justify-between mb-4">
              <span className="label-caps text-[var(--on-surface-variant)]">TIME_SERIES_ANALYSIS</span>
              <div className="flex items-center gap-2">
                <span
                  className="label-caps"
                  style={{ fontSize: 9, color: "var(--teal)" }}
                >
                  ■ PACE
                </span>
                <LegendBtn
                  label={`HR ${showHR ? "ON" : "OFF"}`}
                  active={showHR}
                  color="var(--amber)"
                  onClick={() => setShowHR((v) => !v)}
                />
                <LegendBtn
                  label={`CADENCE ${showCad ? "ON" : "OFF"}`}
                  active={showCad}
                  color="#c084fc"
                  onClick={() => setShowCad((v) => !v)}
                />
                {hasElevData && (
                  <LegendBtn
                    label={`ELEV ${showElev ? "ON" : "OFF"}`}
                    active={showElev}
                    color="#6b7280"
                    onClick={() => setShowElev((v) => !v)}
                  />
                )}
              </div>
            </div>

            {/* Chart */}
            {hasChart ? (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 4, right: chartMarginRight, left: 48, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--surface-container-high)"
                      strokeDasharray=""
                      vertical={false}
                    />
                    <XAxis
                      dataKey={xKey}
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={xTickFmt}
                      axisLine={{ stroke: "var(--outline-variant)" }}
                      tickLine={false}
                      tick={{
                        fill: "var(--on-surface-variant)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                    />
                    {/* Pace axis — left */}
                    <YAxis
                      yAxisId="pace"
                      orientation="left"
                      reversed={true}
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => fmtPace(v)}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--teal)",
                        fontSize: 9,
                        fontFamily: "var(--font-space-grotesk)",
                      }}
                      width={38}
                    />
                    {/* HR axis — right, 1st column */}
                    {showHR && (
                      <YAxis
                        yAxisId="hr"
                        orientation="right"
                        domain={["auto", "auto"]}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--amber)",
                          fontSize: 9,
                          fontFamily: "var(--font-space-grotesk)",
                        }}
                        width={50}
                      />
                    )}
                    {/* Cadence axis — right, 2nd column */}
                    {showCad && (
                      <YAxis
                        yAxisId="cad"
                        orientation="right"
                        domain={[120, 200]}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#c084fc",
                          fontSize: 9,
                          fontFamily: "var(--font-space-grotesk)",
                        }}
                        width={50}
                      />
                    )}
                    {/* Elevation axis — right, 3rd column */}
                    {showElev && (
                      <YAxis
                        yAxisId="elev"
                        orientation="right"
                        domain={["auto", "auto"]}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#6b7280",
                          fontSize: 9,
                          fontFamily: "var(--font-space-grotesk)",
                        }}
                        width={50}
                      />
                    )}
                    <Tooltip
                      content={
                        (props) => (
                          <ChartTooltip
                            active={props.active}
                            payload={props.payload as never}
                            label={props.label as number}
                            xMode={xMode}
                          />
                        )
                      }
                      cursor={{ stroke: "var(--outline-variant)", strokeWidth: 1 }}
                    />
                    <Line
                      yAxisId="pace"
                      dataKey="pace"
                      stroke="var(--teal)"
                      strokeWidth={1}
                      type="linear"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="hr"
                      dataKey="hr"
                      stroke="var(--amber)"
                      strokeWidth={1}
                      type="linear"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                      hide={!showHR}
                    />
                    <Line
                      yAxisId="cad"
                      dataKey="cad"
                      stroke="#c084fc"
                      strokeWidth={0}
                      type="linear"
                      dot={{ r: 1.5, fill: "#c084fc", strokeWidth: 0 }}
                      isAnimationActive={false}
                      connectNulls={false}
                      hide={!showCad}
                    />
                    <Line
                      yAxisId="elev"
                      dataKey="elev"
                      stroke="#6b7280"
                      strokeWidth={1}
                      type="linear"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                      hide={!showElev}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 240 }}>
                <span
                  className="label-caps text-[var(--on-surface-variant)]"
                  style={{ opacity: 0.35 }}
                >
                  NO_TIMESERIES_DATA
                </span>
              </div>
            )}

            {/* X-axis toggle — below chart, right-aligned */}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setXMode((m) => m === "time" ? "dist" : "time")}
                className="label-caps transition-colors"
                style={{
                  padding: "2px 8px",
                  border: "1px solid var(--outline-variant)",
                  color: "var(--on-surface-variant)",
                  fontSize: 9,
                }}
              >
                X: {xMode === "time" ? "TIME" : "DIST"}
              </button>
            </div>
          </div>

          {/* LAP_TABLE */}
          {showLapTable && (
            <div className="flex-shrink-0" style={{ marginTop: 16 }}>
              <div
                className="flex items-center justify-between px-4 py-2"
                style={{ borderBottom: "1px solid var(--outline-variant)" }}
              >
                <span className="label-caps text-[var(--on-surface)]">LAP_TABLE</span>
                <span className="label-caps text-[var(--on-surface-variant)]">
                  {laps.length} LAPS
                </span>
              </div>

              {/* Intent filter buttons */}
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ borderBottom: "1px solid var(--outline-variant)" }}
              >
                {(["ALL", "WARM_UP", "RUN", "INTERVAL", "RECOVERY"] as LapFilter[]).map((f) => (
                  <LapFilterBtn
                    key={f}
                    label={f}
                    active={lapFilter === f}
                    onClick={() => setLapFilter(f)}
                  />
                ))}
              </div>

              {singleIntent ? (
                /* ── Simplified: same intent ───────────────── */
                <>
                  <div
                    className="grid px-4 py-1.5"
                    style={{
                      gridTemplateColumns: "44px 80px 70px 70px",
                      borderBottom: "1px solid var(--outline-variant)",
                      backgroundColor: "var(--surface-container-low)",
                    }}
                  >
                    {["LAP", "DIST", "PACE", "AVG_HR"].map((col) => (
                      <span key={col} className="label-caps text-[var(--on-surface-variant)]">
                        {col}
                      </span>
                    ))}
                  </div>
                  {filteredLaps.map((lap) => (
                    <div
                      key={lap.lap_number}
                      className="grid px-4 py-2"
                      style={{
                        gridTemplateColumns: "44px 80px 70px 70px",
                        borderBottom: "1px solid var(--outline-variant)",
                      }}
                    >
                      <span className="code-data text-[var(--on-surface-variant)]">
                        {lap.lap_number}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">
                        {lap.distance != null ? `${lap.distance.toFixed(2)}k` : "--"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">
                        {lap.avg_pace ?? "--"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">
                        {lap.avg_hr ?? "--"}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                /* ── Full: mixed intents ───────────────────── */
                <>
                  <div
                    className="grid px-4 py-1.5"
                    style={{
                      gridTemplateColumns: "44px 90px 65px 70px 65px 60px 60px 68px 72px",
                      borderBottom: "1px solid var(--outline-variant)",
                      backgroundColor: "var(--surface-container-low)",
                    }}
                  >
                    {["LAP", "INTENT", "DIST", "TIME", "PACE", "AVG_HR", "MAX_HR", "GCT", "CADENCE"].map(
                      (col) => (
                        <span key={col} className="label-caps text-[var(--on-surface-variant)]">
                          {col}
                        </span>
                      )
                    )}
                  </div>
                  {filteredLaps.map((lap) => {
                    const intent = lap.lap_intent ?? "Run"
                    const intentColor =
                      intent === "Interval" ? "var(--amber)"
                      : intent === "Recovery" ? "var(--on-surface-variant)"
                      : intent === "Warm Up"  ? "var(--teal)"
                      : "var(--on-surface)"
                    return (
                      <div
                        key={lap.lap_number}
                        className="grid px-4 py-2"
                        style={{
                          gridTemplateColumns: "44px 90px 65px 70px 65px 60px 60px 68px 72px",
                          borderBottom: "1px solid var(--outline-variant)",
                        }}
                      >
                        <span className="code-data text-[var(--on-surface-variant)]">
                          {lap.lap_number}
                        </span>
                        <span className="code-data" style={{ color: intentColor }}>
                          {intent}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.distance != null ? `${lap.distance.toFixed(2)}k` : "--"}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.time ?? "--"}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.avg_pace ?? "--"}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.avg_hr ?? "--"}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.max_hr ?? "--"}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {fmtGct(lap.avg_gct)}
                        </span>
                        <span className="code-data text-[var(--on-surface)]">
                          {lap.avg_cadence ?? "--"}
                        </span>
                      </div>
                    )
                  })}
                </>
              )}

              {filteredLaps.length === 0 && lapFilter !== "ALL" && (
                <div className="px-4 py-3">
                  <span className="code-data text-[var(--on-surface-variant)]">
                    NO_LAPS — no {intentToFilter[lapFilter]} laps in this session
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column (30%) ────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

          {/* BIOMECHANICS_TELEMETRY */}
          <div
            className="flex flex-col p-3 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <span className="label-caps text-[var(--on-surface-variant)] mb-4">
              BIOMECHANICS_TELEMETRY
            </span>

            <div className="flex flex-col gap-4">

              {/* GCT */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[var(--on-surface-variant)]">GCT</span>
                  <span className="code-data text-[var(--on-surface)]">{fmtGct(run.avg_gct)}</span>
                </div>
                <MetricBar
                  value={run.avg_gct}
                  rangeMin={200} rangeMax={350}
                  targetMin={260} targetMax={280}
                  warnAbove={290}
                />
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9, opacity: 0.5 }}>
                  TARGET 260–280ms · WARN &gt;290ms
                </span>
              </div>

              {/* Cadence */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[var(--on-surface-variant)]">CADENCE</span>
                  <span className="code-data text-[var(--on-surface)]">
                    {run.avg_cadence != null ? `${run.avg_cadence} spm` : "--"}
                  </span>
                </div>
                <MetricBar
                  value={run.avg_cadence}
                  rangeMin={140} rangeMax={210}
                  targetMin={170} targetMax={175}
                />
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9, opacity: 0.5 }}>
                  TARGET 170–175spm
                </span>
              </div>

              {/* Vertical ratio */}
              {vertRatio != null && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="label-caps text-[var(--on-surface-variant)]">VERTICAL_RATIO</span>
                    <span className="code-data text-[var(--on-surface)]">{vertRatio.toFixed(1)}%</span>
                  </div>
                  <MetricBar
                    value={vertRatio}
                    rangeMin={5} rangeMax={14}
                    targetMin={5} targetMax={9}
                    warnAbove={10}
                  />
                  <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9, opacity: 0.5 }}>
                    TARGET &lt;9%
                  </span>
                </div>
              )}

              {/* Vertical oscillation */}
              {run.avg_vertical_oscillation != null && (
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[var(--on-surface-variant)]">VERTICAL_OSC</span>
                  <span className="code-data text-[var(--on-surface)]">
                    {run.avg_vertical_oscillation.toFixed(1)} cm
                  </span>
                </div>
              )}

              {/* Stride length */}
              {avgStride != null && (
                <div className="flex items-center justify-between">
                  <span className="label-caps text-[var(--on-surface-variant)]">STRIDE_LENGTH</span>
                  <span className="code-data text-[var(--on-surface)]">{avgStride.toFixed(2)} m</span>
                </div>
              )}

            </div>
          </div>

          {/* SYSTEM_CRITIQUE */}
          <div className="flex flex-col p-3">
            <span className="label-caps text-[var(--on-surface-variant)] mb-3">SYSTEM_CRITIQUE</span>
            <div className="flex flex-col gap-2">
              {flags.map((flag, i) => (
                <div key={i} className="code-data flex items-start gap-2">
                  <span style={{ color: "var(--teal)", flexShrink: 0 }}>&gt;</span>
                  <span className="text-[var(--on-surface)]">{flag}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
