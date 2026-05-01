"use client"

import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from "recharts"
import type { MetricsSummary } from "@/lib/hermes"
import type { MergedDayRow, BlockInfo } from "@/lib/supabase/training"
import { fmtPace } from "@/lib/pace"

/* ─── Static data ───────────────────────────────────────── */

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

// 13 cols × 7 rows — 0=dim, 1=teal, 2=amber, 3=surface-high
const HEATMAP: number[][] = [
  [3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 3, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
  [3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2],
  [1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1],
  [1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 2, 1],
]

/* ─── Date helpers ──────────────────────────────────────── */

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${dow} ${d.getDate()}`
}

function fmtDist(km: number): string {
  return `${km.toFixed(1)}k`
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

/* ─── Comply square ─────────────────────────────────────── */

function ComplySquare({ comply }: { comply: MergedDayRow["comply"] }) {
  if (comply === "full")
    return (
      <span
        className="inline-block"
        style={{ width: 8, height: 8, backgroundColor: "var(--teal)", flexShrink: 0 }}
      />
    )
  if (comply === "partial")
    return (
      <span
        className="inline-block"
        style={{ width: 8, height: 8, backgroundColor: "var(--amber)", flexShrink: 0 }}
      />
    )
  return (
    <span
      className="inline-block"
      style={{
        width: 8,
        height: 8,
        border: "1px solid var(--amber)",
        backgroundColor: "transparent",
        flexShrink: 0,
      }}
    />
  )
}

/* ─── Client component ──────────────────────────────────── */

export default function TrainingPlanClient({
  metrics,
  weekData,
  noBlock,
  block,
  raceConfig,
}: {
  metrics: MetricsSummary | null
  weekData: MergedDayRow[] | null
  noBlock: boolean
  block?: BlockInfo | null
  raceConfig: { race_name: string | null; race_date: string | null } | null
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
  const completedCount = weekData?.filter((r) => r.comply !== "upcoming").length ?? 0
  const totalCount = weekData?.length ?? 0

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
              <span className="text-[var(--teal)]">
                {weekNum != null ? `W${weekNum}` : "—"}
              </span>
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

          <div className="flex flex-col">
            {noBlock ? (
              <div className="px-4 py-3">
                <span className="code-data text-[var(--on-surface-variant)]">
                  NO_ACTIVE_BLOCK — create a training block to get started
                </span>
              </div>
            ) : weekData && weekData.length > 0 ? (
              weekData.map((row, i) => (
                <div
                  key={row.date}
                  className="grid items-center px-4 py-2.5"
                  style={{
                    gridTemplateColumns: "80px 1fr 70px 70px 70px 70px 55px 50px",
                    borderBottom: "1px solid var(--outline-variant)",
                    backgroundColor: i % 2 === 0 ? "transparent" : "var(--surface-container-low)",
                  }}
                >
                  <span className="code-data text-[var(--on-surface-variant)]">
                    {fmtDate(row.date)}
                  </span>
                  <span className="code-data font-medium" style={{ color: "var(--teal)" }}>
                    {row.workoutType}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">
                    {fmtDist(row.targetDistKm)}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">
                    {row.actualDistKm != null ? fmtDist(row.actualDistKm) : "--"}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">
                    {row.targetPaceSec != null ? fmtPace(row.targetPaceSec) : "--"}
                  </span>
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
              ))
            ) : (
              <div className="px-4 py-3">
                <span className="code-data text-[var(--on-surface-variant)]">
                  NO_SESSIONS — no workouts scheduled for this week
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Heatmap + HRV chart */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* 90D_CONSISTENCY heatmap */}
          <div
            className="flex flex-col p-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <span className="label-caps text-[var(--on-surface-variant)] mb-3">
              90D_CONSISTENCY
            </span>
            <div className="flex flex-col w-full" style={{ gap: 3 }}>
              {HEATMAP.map((row, ri) => (
                <div
                  key={ri}
                  style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 3 }}
                >
                  {row.map((cell, ci) => (
                    <span
                      key={ci}
                      style={{
                        aspectRatio: "1",
                        minWidth: 14,
                        minHeight: 14,
                        backgroundColor:
                          cell === 1 ? "var(--teal)"
                          : cell === 2 ? "var(--amber)"
                          : cell === 3 ? "var(--surface-container-high)"
                          : "var(--surface-container)",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

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
