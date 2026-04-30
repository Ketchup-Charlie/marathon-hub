"use client"

import { useState, useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from "recharts"

/* ─── Static data ───────────────────────────────────────── */

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
    value: "172",
    delta: null,
    deltaDir: null,
    unit: "spm",
  },
  {
    label: "HRV_BASELINE",
    value: "68",
    delta: "↑",
    deltaDir: "up" as const,
    unit: "ms",
  },
]

type SessionRow = {
  date: string
  type: string
  tDist: string
  aDist: string | null
  tPace: string
  aPace: string | null
  comply: "full" | "partial" | "upcoming"
}

const SESSIONS: SessionRow[] = [
  { date: "Mon 12", type: "RECOVERY",     tDist: "8.0k",  aDist: "8.1k",  tPace: "5:30", aPace: "5:28", comply: "full"     },
  { date: "Tue 13", type: "INTERVALS",    tDist: "12.0k", aDist: "12.0k", tPace: "4:15", aPace: "4:12", comply: "full"     },
  { date: "Wed 14", type: "EASY_AEROBIC", tDist: "14.0k", aDist: "10.5k", tPace: "5:00", aPace: "5:15", comply: "partial"  },
  { date: "Thu 15", type: "TEMPO",        tDist: "16.0k", aDist: null,    tPace: "4:30", aPace: null,   comply: "upcoming" },
]

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

// 13 cols × 7 rows heatmap — 0=empty, 1=teal, 2=amber, 3=dim
const HEATMAP: number[][] = [
  [3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 3, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
  [3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2],
  [1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1],
  [1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 2, 1],
]

/* ─── Pace calc helpers ─────────────────────────────────── */

function parseHMS(s: string): number | null {
  const parts = s.split(":").map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, "0")}`
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

function ComplySquare({ comply }: { comply: SessionRow["comply"] }) {
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

/* ─── Page ──────────────────────────────────────────────── */

export default function TrainingBlocksPage() {
  const [targetTime, setTargetTime] = useState("03:15:00")

  const paces = useMemo(() => {
    const total = parseHMS(targetTime)
    if (!total) return null
    const mp = total / 42.195
    return {
      mp:    fmtPace(mp),
      tempo: fmtPace(mp * 0.939),
      int:   fmtPace(mp * 0.848),
      easy:  fmtPace(mp * 1.141),
    }
  }, [targetTime])

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
            <span className="text-[var(--teal)]">BASE_W3</span>
          </span>
          <span className="label-caps text-[var(--on-surface-variant)]">
            RACE_TARGET:{" "}
            <span className="text-[var(--on-surface)]">Sydney Marathon Aug 30</span>
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1"
          style={{ border: "1px solid var(--outline-variant)" }}
        >
          <span className="label-caps text-[var(--on-surface-variant)]">DAYS_TO_RACE:</span>
          <span className="label-caps text-[var(--teal)] text-base">122</span>
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
                  style={{
                    color:
                      card.deltaDir === "up"
                        ? "var(--teal)"
                        : card.deltaDir === "down"
                        ? "var(--teal)"
                        : "var(--on-surface-variant)",
                  }}
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
          {/* Table header bar */}
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--outline-variant)" }}
          >
            <span className="label-caps text-[var(--on-surface)]">
              EXECUTION_LOG{" "}
              <span className="text-[var(--on-surface-variant)]">::</span>{" "}
              <span className="text-[var(--teal)]">W3</span>
            </span>
            <span className="label-caps text-[var(--on-surface-variant)]">
              4/7 SESSIONS
            </span>
          </div>

          {/* Column headers */}
          <div
            className="grid flex-shrink-0 px-4 py-1.5"
            style={{
              gridTemplateColumns: "80px 1fr 70px 70px 70px 70px 50px",
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {["DATE", "WORKOUT_TYPE", "T_DIST", "A_DIST", "T_PACE", "A_PACE", "COMPLY"].map(
              (col) => (
                <span
                  key={col}
                  className="label-caps text-[var(--on-surface-variant)]"
                >
                  {col}
                </span>
              )
            )}
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {SESSIONS.map((row, i) => (
              <div
                key={row.date}
                className="grid items-center px-4 py-2.5"
                style={{
                  gridTemplateColumns: "80px 1fr 70px 70px 70px 70px 50px",
                  borderBottom: "1px solid var(--outline-variant)",
                  backgroundColor:
                    i % 2 === 0 ? "transparent" : "var(--surface-container-low)",
                }}
              >
                <span className="code-data text-[var(--on-surface-variant)]">
                  {row.date}
                </span>
                <span
                  className="code-data font-medium"
                  style={{ color: "var(--teal)" }}
                >
                  {row.type}
                </span>
                <span className="code-data text-[var(--on-surface)]">
                  {row.tDist}
                </span>
                <span className="code-data text-[var(--on-surface)]">
                  {row.aDist ?? "--"}
                </span>
                <span className="code-data text-[var(--on-surface)]">
                  {row.tPace}
                </span>
                <span className="code-data text-[var(--on-surface)]">
                  {row.aPace ?? "--"}
                </span>
                <div className="flex items-center">
                  <ComplySquare comply={row.comply} />
                </div>
              </div>
            ))}
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
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(13, 1fr)",
                    gap: 3,
                  }}
                >
                  {row.map((cell, ci) => (
                    <span
                      key={ci}
                      style={{
                        aspectRatio: "1",
                        minWidth: 14,
                        minHeight: 14,
                        backgroundColor:
                          cell === 1
                            ? "var(--teal)"
                            : cell === 2
                            ? "var(--amber)"
                            : cell === 3
                            ? "var(--surface-container-high)"
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

      {/* ── PACE_CALC_V2 footer ───────────────────────────── */}
      <div
        className="flex items-center gap-6 px-4 flex-shrink-0"
        style={{
          height: 40,
          backgroundColor: "var(--surface-container-low)",
          borderTop: "1px solid var(--outline-variant)",
        }}
      >
        <span
          className="label-caps flex-shrink-0"
          style={{ color: "var(--teal)" }}
        >
          PACE_CALC_V2
        </span>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">
            TARGET_TIME:
          </span>
          <input
            type="text"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            className="code-data text-[var(--teal)] bg-transparent outline-none w-24"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              caretColor: "var(--teal)",
            }}
            placeholder="hh:mm:ss"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center gap-6 ml-auto">
          {paces && (
            <>
              <span className="label-caps text-[var(--on-surface-variant)]">
                MP:{" "}
                <span className="text-[var(--on-surface)]">{paces.mp}</span>
              </span>
              <span className="label-caps text-[var(--on-surface-variant)]">
                TEMPO:{" "}
                <span className="text-[var(--on-surface)]">{paces.tempo}</span>
              </span>
              <span className="label-caps text-[var(--on-surface-variant)]">
                INT:{" "}
                <span className="text-[var(--amber)]">{paces.int}</span>
              </span>
              <span className="label-caps text-[var(--on-surface-variant)]">
                EASY:{" "}
                <span className="text-[var(--on-surface)]">{paces.easy}</span>
              </span>
            </>
          )}
          <div
            className="flex items-center gap-4 pl-4"
            style={{ borderLeft: "1px solid var(--outline-variant)" }}
          >
            <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
              PACE_CALCULATOR_V1.0
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
              LATENCY: 12MS
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
              CORE_TEMP: 36.5C
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
