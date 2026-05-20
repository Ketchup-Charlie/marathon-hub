"use client"

import React from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from "recharts"
import type { MetricsSummary, MomentumDay } from "@/lib/hermes"
import type { MergedDayRow, BlockInfo } from "@/lib/supabase/training"
import { fmtPace } from "@/lib/pace"

/* ─── HRV static data ───────────────────────────────────── */

const HRV_DATA = [
  { week: "W1",  hrv: 61, isLatest: false },
  { week: "W2",  hrv: 63, isLatest: false },
  { week: "W3",  hrv: 60, isLatest: false },
  { week: "W4",  hrv: 65, isLatest: false },
  { week: "W5",  hrv: 62, isLatest: false },
  { week: "W6",  hrv: 66, isLatest: false },
  { week: "W7",  hrv: 64, isLatest: false },
  { week: "W8",  hrv: 67, isLatest: false },
  { week: "W9",  hrv: 65, isLatest: false },
  { week: "W10", hrv: 69, isLatest: false },
  { week: "W11", hrv: 67, isLatest: false },
  { week: "W12", hrv: 68, isLatest: true  },
]

/* ─── Date helpers ──────────────────────────────────────── */

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${dow} ${d.getDate()}`
}

function fmtDist(km: number | null): string {
  if (km == null) return "--"
  return `${km.toFixed(1)}k`
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function daysToRace(raceDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const race = new Date(raceDate + "T00:00:00")
  return Math.max(0, Math.ceil((race.getTime() - today.getTime()) / 86_400_000))
}

function blockWeekNum(startDate: string): number {
  const start = new Date(startDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (86_400_000 * 7)))
}

function fmtRaceDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/* ─── HRV bar shape ─────────────────────────────────────── */

function HrvBar(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  isLatest?: boolean
}) {
  const { x = 0, y = 0, width = 0, height = 0, isLatest } = props
  if (height <= 0) return null
  const fill = isLatest ? "var(--amber)" : "#252b31"
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      {!isLatest && (
        <rect x={x} y={y} width={width} height={1} fill="var(--teal)" />
      )}
    </g>
  )
}

/* ─── Workout type cell ─────────────────────────────────── */

const WORKOUT_TYPE_COLOR: Record<string, string> = {
  Easy:     "#4ade80",
  Tempo:    "var(--amber)",
  Interval: "#ffb300",
  Long:     "#c084fc",
  Race:     "var(--amber)",
  Strength: "var(--on-surface-variant)",
  Rest:     "var(--on-surface-variant)",
}

function WorkoutTypeCell({ type, secondaryType, description, secondaryDescription }: {
  type: string
  secondaryType: string | null
  description: string | null
  secondaryDescription: string | null
}) {
  const color = WORKOUT_TYPE_COLOR[type] ?? "var(--on-surface-variant)"
  const isRace = type === "Race"
  return (
    <div className="flex flex-col">
      <span className="code-data" style={{ color, fontWeight: isRace ? 700 : 400 }}>
        {isRace ? `🏁 ${type}` : type}
        {description && (
          <span className="code-data" style={{ color: "var(--on-surface-variant)", fontWeight: 400, opacity: 0.65 }}>
            {" "}— {description}
          </span>
        )}
      </span>
      {secondaryType && (
        <span className="code-data" style={{ color: "#a78bfa", fontSize: 10, opacity: 0.85 }}>
          {secondaryType}
          {secondaryDescription && (
            <span className="code-data" style={{ color: "var(--on-surface-variant)", fontWeight: 400, opacity: 0.65 }}>
              {" "}— {secondaryDescription}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

/* ─── Comply square ─────────────────────────────────────── */

function ComplySquare({ comply }: { comply: MergedDayRow["comply"] }) {
  if (comply == null) return null
  if (comply === "green")
    return (
      <span
        className="inline-block"
        style={{ width: 8, height: 8, backgroundColor: "var(--teal)", flexShrink: 0 }}
      />
    )
  if (comply === "amber")
    return (
      <span
        className="inline-block"
        style={{ width: 8, height: 8, backgroundColor: "var(--amber)", flexShrink: 0 }}
      />
    )
  if (comply === "red")
    return (
      <span
        className="inline-block"
        style={{ width: 8, height: 8, backgroundColor: "#e05252", flexShrink: 0 }}
      />
    )
  // "upcoming"
  return (
    <span
      className="inline-block"
      style={{
        width: 8,
        height: 8,
        border: "1px solid var(--outline-variant)",
        backgroundColor: "transparent",
        flexShrink: 0,
      }}
    />
  )
}

/* ─── Momentum heatmap ──────────────────────────────────── */

function squareStyle(day: MomentumDay | undefined): React.CSSProperties {
  if (day?.hasRun)     return { backgroundColor: "var(--teal)" }
  if (day?.hasPlanned) return { backgroundColor: "transparent", border: "1px solid var(--amber)" }
  return { backgroundColor: "#1a2027" }
}

function MomentumHeatmap({ days }: { days: MomentumDay[] }) {
  const dayMap = new Map(days.map((d) => [d.date, d]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex flex-col p-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
      <span className="label-caps text-[var(--on-surface-variant)] mb-3">MOMENTUM</span>

      <div className="flex flex-col" style={{ gap: 3 }}>
        {Array.from({ length: 6 }, (_, row) => (
          <div
            key={row}
            style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 3 }}
          >
            {Array.from({ length: 14 }, (_, col) => {
              const idx = row * 14 + col
              const d = new Date(today)
              d.setDate(d.getDate() - idx)
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
              const day = dayMap.get(date)
              return (
                <span
                  key={col}
                  title={date}
                  style={{
                    aspectRatio: "1",
                    minWidth: 13,
                    minHeight: 13,
                    display: "block",
                    ...squareStyle(day),
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 8, height: 8, backgroundColor: "var(--teal)" }} />
          <span className="label-caps text-[var(--on-surface-variant)]">RAN</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block"
            style={{ width: 8, height: 8, border: "1px solid var(--amber)", backgroundColor: "transparent" }}
          />
          <span className="label-caps text-[var(--on-surface-variant)]">MISSED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 8, height: 8, backgroundColor: "#1a2027" }} />
          <span className="label-caps text-[var(--on-surface-variant)]">REST</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Client component ──────────────────────────────────── */

export default function TrainingPlanClient({
  metrics,
  weekData,
  noBlock,
  block,
  raceConfig,
  momentumDays,
}: {
  metrics: MetricsSummary | null
  weekData: MergedDayRow[] | null
  noBlock: boolean
  block?: BlockInfo | null
  raceConfig: { race_name: string | null; race_date: string | null } | null
  momentumDays: MomentumDay[]
}) {
  const raceName = raceConfig?.race_name ?? block?.name ?? null
  const raceDate = raceConfig?.race_date ?? block?.race_date ?? null
  const raceTargetLabel =
    [raceName, raceDate ? fmtRaceDate(raceDate) : null].filter(Boolean).join(" ") || "—"
  const METRIC_CARDS = [
    {
      label: "AVG_PACE_7D",
      value: "7:38",
      delta: "↓0:04",
      deltaDir: "down" as const,
      unit: "",
    },
    {
      label: "RESTING_HR",
      value: "42",
      delta: null,
      deltaDir: null,
      unit: "bpm",
    },
    {
      label: "TRAINING_LOAD",
      value: "312",
      delta: "+8%",
      deltaDir: "up" as const,
      unit: "",
    },
    {
      label: "CADENCE_AVG",
      value: String(metrics?.cadence_avg_spm != null ? Math.round(metrics.cadence_avg_spm) : 172),
      delta: null,
      deltaDir: null,
      unit: "spm",
    },
    {
      label: "HRV_BASELINE",
      value: String(metrics?.hrv_baseline_ms != null ? Math.round(metrics.hrv_baseline_ms) : 68),
      delta: "↑",
      deltaDir: "up" as const,
      unit: "ms",
    },
  ]

  const weekNum = block ? blockWeekNum(block.start_date) : null
  const today = todayStr()
  const completedCount = weekData?.filter((r) => r.dayType === "planned" && r.comply !== null && r.comply !== "upcoming").length ?? 0
  const totalCount = weekData?.filter((r) => r.dayType === "planned").length ?? 0

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--surface)" }}
    >
      {/* ── Status bar ────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-4"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <div className="flex items-center gap-6">
          <span className="label-caps text-[var(--on-surface-variant)]">
            BLOCK_PHASE:{" "}
            <span className="text-[var(--teal)]">
              {block ? `BASE_W${weekNum}` : "—"}
            </span>
          </span>
          <span className="label-caps text-[var(--on-surface-variant)]">
            RACE_TARGET:{" "}
            <span className="text-[var(--on-surface)]">
              {raceTargetLabel}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/training-blocks/block-view"
            className="label-caps px-3 py-1 hover:text-[var(--teal)]"
            style={{
              border: "1px solid var(--outline-variant)",
              color: "var(--on-surface-variant)",
              textDecoration: "none",
            }}
          >
            BLOCK_VIEW
          </Link>
          <div
            className="flex items-center gap-2 px-3 py-1"
            style={{ border: "1px solid var(--outline-variant)" }}
          >
            <span className="label-caps text-[var(--on-surface-variant)]">DAYS_TO_RACE:</span>
            <span className="label-caps text-[var(--teal)] text-base">
              {raceDate ? daysToRace(raceDate) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Metric cards row ──────────────────────────────── */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        {METRIC_CARDS.map((card, i) => (
          <div
            key={card.label}
            className="flex-1 flex flex-col justify-center px-4 py-3"
            style={{
              borderRight: i < METRIC_CARDS.length - 1 ? "1px solid var(--outline-variant)" : undefined,
            }}
          >
            <div className="label-caps text-[var(--on-surface-variant)] mb-1">
              {card.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="metric-lg text-[var(--on-surface)]">
                {card.value}
              </span>
              {card.unit && (
                <span
                  className="text-xl font-semibold text-[var(--on-surface)]"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {card.unit}
                </span>
              )}
              {card.delta && (
                <span
                  className="label-caps"
                  style={{ color: "var(--teal)" }}
                >
                  {card.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: EXECUTION_LOG */}
        <div
          className="flex flex-col min-w-0"
          style={{
            flex: "0 0 70%",
            borderRight: "1px solid var(--outline-variant)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <span className="label-caps text-[var(--on-surface)]">
              EXECUTION_LOG{" "}
              <span className="text-[var(--on-surface-variant)]">::</span>{" "}
              <span className="text-[var(--teal)]">ROLLING_15D</span>
            </span>
            <span className="label-caps text-[var(--on-surface-variant)]">
              {noBlock ? "—" : `${completedCount}/${totalCount} SESSIONS`}
            </span>
          </div>

          <div
            className="grid flex-shrink-0 px-4 py-1.5"
            style={{
              gridTemplateColumns: "80px 1fr 70px 70px 70px 70px 55px 50px",
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {["DATE", "WORKOUT_TYPE", "T_DIST", "A_DIST", "T_PACE", "A_PACE", "AVG_HR", "COMPLY"].map(
              (col) => (
                <span key={col} className="label-caps text-[var(--on-surface-variant)]">
                  {col}
                </span>
              )
            )}
          </div>

          <div className="flex flex-col overflow-y-auto">
            {noBlock ? (
              <div className="px-4 py-3">
                <span className="code-data text-[var(--on-surface-variant)]">
                  NO_ACTIVE_BLOCK — create a training block to get started
                </span>
              </div>
            ) : weekData && weekData.length > 0 ? (
              weekData.map((row) => {
                const isToday = row.date === today
                const isFuture = row.comply === "upcoming"
                const rowStyle: React.CSSProperties = {
                  gridTemplateColumns: "80px 1fr 70px 70px 70px 70px 55px 50px",
                  borderBottom: "1px solid var(--outline-variant)",
                  paddingLeft: isToday ? "13px" : "16px",
                  paddingRight: "16px",
                  borderLeft: isToday ? "3px solid var(--teal)" : undefined,
                  backgroundColor: isToday ? "rgba(45, 219, 222, 0.05)" : "transparent",
                }

                // ── empty + no run ───────────────────────────
                if (row.dayType === "empty" && row.actualDistKm == null) {
                  return (
                    <div key={row.date} className="grid items-center py-2" style={rowStyle}>
                      <span className="code-data text-[var(--on-surface-variant)]">
                        {fmtDate(row.date)}
                      </span>
                      <span className="code-data" style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}>
                        EMPTY
                      </span>
                      <span /><span /><span /><span /><span /><span />
                    </div>
                  )
                }

                // ── empty + run ──────────────────────────────
                if (row.dayType === "empty") {
                  return (
                    <div key={row.date} className="grid items-center py-2.5" style={rowStyle}>
                      <span className="code-data text-[var(--on-surface-variant)]">
                        {fmtDate(row.date)}
                      </span>
                      <span className="code-data text-[var(--on-surface-variant)]">
                        {row.runTypeTag ?? "UNPLANNED"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">--</span>
                      <span className="code-data text-[var(--on-surface)]">
                        {fmtDist(row.actualDistKm)}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">--</span>
                      <span className="code-data text-[var(--on-surface)]">
                        {row.actualPaceStr ?? "--"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">
                        {row.avgHr != null ? String(Math.round(row.avgHr)) : "--"}
                      </span>
                      <span />
                    </div>
                  )
                }

                // ── rest (with or without run) ───────────────
                if (row.dayType === "rest") {
                  return (
                    <div key={row.date} className="grid items-center py-2.5" style={rowStyle}>
                      <span className="code-data text-[var(--on-surface-variant)]">
                        {fmtDate(row.date)}
                      </span>
                      <span className="code-data" style={{ color: "var(--on-surface-variant)", opacity: 0.4 }}>
                        REST
                      </span>
                      <span className="code-data text-[var(--on-surface)]">--</span>
                      <span className="code-data text-[var(--on-surface)]">
                        {row.actualDistKm != null ? fmtDist(row.actualDistKm) : "--"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">--</span>
                      <span className="code-data text-[var(--on-surface)]">
                        {row.actualPaceStr ?? "--"}
                      </span>
                      <span className="code-data text-[var(--on-surface)]">
                        {row.avgHr != null ? String(Math.round(row.avgHr)) : "--"}
                      </span>
                      <div className="flex items-center">
                        <ComplySquare comply={row.comply} />
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={row.date} className="grid items-center py-2.5" style={rowStyle}>
                    <span className="code-data text-[var(--on-surface-variant)]">
                      {fmtDate(row.date)}
                    </span>
                    <WorkoutTypeCell type={row.workoutType} secondaryType={row.secondaryType} description={row.description} secondaryDescription={row.secondaryDescription} />
                    <span className="code-data text-[var(--on-surface)]">
                      {fmtDist(row.targetDistKm)}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {!isFuture ? fmtDist(row.actualDistKm) : "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {row.targetPaceSec != null ? fmtPace(row.targetPaceSec) : "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {!isFuture ? (row.actualPaceStr ?? "--") : "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {!isFuture && row.avgHr != null ? String(Math.round(row.avgHr)) : "--"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ComplySquare comply={row.comply} />
                      {row.segmentTarget && !isFuture && (
                        <span
                          className="label-caps text-[var(--on-surface-variant)]"
                          style={{ fontSize: 9 }}
                        >
                          SEG
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-4 py-3">
                <span className="code-data text-[var(--on-surface-variant)]">
                  NO_SESSIONS — no workouts scheduled for this period
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Heatmap + HRV chart */}
        <div className="flex flex-col flex-1 min-w-0">

          <MomentumHeatmap days={momentumDays} />

          {/* HRV_TREND_12W */}
          <div className="flex flex-col p-4">
            <span className="label-caps text-[var(--on-surface-variant)] mb-3">
              HRV_TREND_12W
            </span>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={HRV_DATA}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                  barSize={16}
                  barCategoryGap={4}
                >
                  <XAxis
                    dataKey="week"
                    axisLine={{ stroke: "var(--teal)", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{
                      fill: "var(--on-surface-variant)",
                      fontSize: 9,
                      fontFamily: "var(--font-space-grotesk)",
                    }}
                  />
                  <Bar dataKey="hrv" shape={HrvBar as never} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
