"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { fmtPace } from "@/lib/pace"

/* ─── Types ──────────────────────────────────────────────── */

export type ProgressionRun = {
  id: string
  date: string
  title: string | null
  run_type_tag: string | null
  total_distance: number | null
  avg_pace: string | null
  avg_hr: number | null
  avg_gct: number | null
  avg_cadence: number | null
  avg_vertical_oscillation: number | null
  compliance_score: string | null
}

type MetricKey = "AVG_PACE" | "AVG_HR" | "GCT" | "CADENCE" | "VERTICAL_RATIO" | "DISTANCE"
type SortKey   = "date" | "title" | "total_distance" | "avg_pace_sec" | "avg_hr" | "avg_gct" | "avg_cadence" | "compliance_score"
type SortDir   = "asc" | "desc"

type ChartRow = { date: string; runId: string } & Record<string, number | string | null | undefined>

/* ─── Constants ──────────────────────────────────────────── */

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "AVG_PACE",       label: "AVG_PACE"  },
  { key: "AVG_HR",         label: "AVG_HR"    },
  { key: "GCT",            label: "GCT"       },
  { key: "CADENCE",        label: "CADENCE"   },
  { key: "VERTICAL_RATIO", label: "VERT_OSC"  },
  { key: "DISTANCE",       label: "DISTANCE"  },
]

const METRIC_COLORS: Record<MetricKey, string> = {
  AVG_PACE:       "var(--teal)",
  AVG_HR:         "var(--amber)",
  GCT:            "#c084fc",
  CADENCE:        "#c084fc",
  VERTICAL_RATIO: "#6b7280",
  DISTANCE:       "#4ade80",
}

const RUN_TYPES  = ["All", "Easy", "Long", "Tempo", "Interval", "Race"]
const TABLE_COLS = "80px 1fr 86px 72px 60px 72px 72px 60px"

const LOWER_IS_BETTER: Record<MetricKey, boolean> = {
  AVG_PACE:       true,
  AVG_HR:         true,
  GCT:            true,
  CADENCE:        false,
  VERTICAL_RATIO: true,
  DISTANCE:       false,
}

/* ─── Helpers ────────────────────────────────────────────── */

function parsePaceToSec(pace: string | null): number | null {
  if (!pace) return null
  const parts = pace.split(":").map(Number)
  if (parts.length === 2 && !parts.some(isNaN)) return parts[0] * 60 + parts[1]
  return null
}

function getMetricValue(run: ProgressionRun, metric: MetricKey): number | null {
  switch (metric) {
    case "AVG_PACE":       return parsePaceToSec(run.avg_pace)
    case "AVG_HR":         return run.avg_hr
    case "GCT":            return run.avg_gct
    case "CADENCE":        return run.avg_cadence
    case "VERTICAL_RATIO": return run.avg_vertical_oscillation
    case "DISTANCE":       return run.total_distance
  }
}

function formatMetricValue(v: number, metric: MetricKey): string {
  switch (metric) {
    case "AVG_PACE":       return `${fmtPace(v)}/km`
    case "AVG_HR":         return `${Math.round(v)} bpm`
    case "GCT":            return `${Math.round(v)} ms`
    case "CADENCE":        return `${Math.round(v)} spm`
    case "VERTICAL_RATIO": return `${v.toFixed(1)} cm`
    case "DISTANCE":       return `${v.toFixed(2)} km`
  }
}

function yAxisFmt(v: number, metric: MetricKey): string {
  if (metric === "AVG_PACE")       return fmtPace(v)
  if (metric === "VERTICAL_RATIO") return v.toFixed(1)
  if (metric === "DISTANCE")       return v.toFixed(1)
  return String(Math.round(v))
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = xs.length
  if (n < 2) return null
  const mx  = xs.reduce((s, x) => s + x, 0) / n
  const my  = ys.reduce((s, y) => s + y, 0) / n
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (den === 0) return null
  return { slope: num / den, intercept: my - (num / den) * mx }
}

function getTrendDir(slope: number, range: number, metric: MetricKey): "IMPROVING" | "DECLINING" | "STABLE" {
  if (range === 0 || Math.abs(slope) < range * 0.005) return "STABLE"
  return (LOWER_IS_BETTER[metric] ? slope < 0 : slope > 0) ? "IMPROVING" : "DECLINING"
}

function bestStreak(runs: ProgressionRun[]): number {
  if (runs.length === 0) return 0
  const dates = [...new Set(runs.map((r) => r.date))].sort()
  let best = 1, streak = 1
  for (let i = 1; i < dates.length; i++) {
    const diffMs = new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()
    if (Math.round(diffMs / 86400000) === 1) {
      streak++
      if (streak > best) best = streak
    } else {
      streak = 1
    }
  }
  return best
}

/* ─── Compliance dot ─────────────────────────────────────── */

function ComplianceDot({ score }: { score: string | null }) {
  if (!score) return <span className="code-data text-[var(--on-surface-variant)]">--</span>
  const bg =
    score === "Green"  ? "var(--teal)"
    : score === "Yellow" ? "var(--amber)"
    : "#e05252"
  return (
    <span className="inline-block" style={{ width: 8, height: 8, backgroundColor: bg, flexShrink: 0 }} />
  )
}

/* ─── Chart tooltip ──────────────────────────────────────── */

function ChartTooltip({
  active,
  payload,
  selectedMetrics,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow; dataKey: string; value: number | null }>
  selectedMetrics: MetricKey[]
}) {
  if (!active || !payload?.length) return null
  const base = payload[0]?.payload
  if (!base) return null
  return (
    <div
      className="flex flex-col gap-0.5 px-2.5 py-2"
      style={{
        backgroundColor: "var(--surface-container-high)",
        border: "1px solid var(--outline-variant)",
      }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{base.date as string}</span>
      {selectedMetrics.map((m) => {
        const val = base[`v_${m}`] as number | null | undefined
        if (val == null) return null
        return (
          <span key={m} className="code-data" style={{ color: METRIC_COLORS[m] }}>
            {METRICS.find((x) => x.key === m)?.label}: {formatMetricValue(val, m)}
          </span>
        )
      })}
      <span className="label-caps" style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.5 }}>
        CLICK TO OPEN
      </span>
    </div>
  )
}

/* ─── Stat card ──────────────────────────────────────────── */

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div
      className="flex flex-col px-4 py-2.5"
      style={{ border: "1px solid var(--outline-variant)", minWidth: 110 }}
    >
      <span className="label-caps text-[var(--on-surface-variant)]">{label}</span>
      <span className="metric-lg mt-0.5" style={{ color: color ?? "var(--on-surface)" }}>{value}</span>
      {sub && (
        <span className="label-caps mt-0.5" style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.55 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

/* ─── Sort header ────────────────────────────────────────── */

function SortHeader({
  label, sk, activeSk, dir, onSort,
}: {
  label: string; sk: SortKey; activeSk: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = sk === activeSk
  return (
    <button
      className="label-caps text-left transition-colors"
      style={{ color: active ? "var(--teal)" : "var(--on-surface-variant)" }}
      onClick={() => onSort(sk)}
    >
      {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function ProgressionClient({ runs }: { runs: ProgressionRun[] }) {
  const router = useRouter()

  const [runType,          setRunType]          = useState("All")
  const [fromDate,         setFromDate]         = useState("")
  const [toDate,           setToDate]           = useState("")
  const [selectedMetrics,  setSelectedMetrics]  = useState<MetricKey[]>(["AVG_PACE"])
  const [sortKey,          setSortKey]          = useState<SortKey>("date")
  const [sortDir,          setSortDir]          = useState<SortDir>("desc")

  const primaryMetric = selectedMetrics[0]

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key)
      if (prev.length >= 3) return prev
      return [...prev, key]
    })
  }

  /* ── Filtered ───────────────────────────────────────────── */

  const filtered = useMemo(() => runs.filter((r) => {
    if (runType !== "All" && r.run_type_tag !== runType) return false
    if (fromDate && r.date < fromDate) return false
    if (toDate   && r.date > toDate)   return false
    return true
  }), [runs, runType, fromDate, toDate])

  /* ── Chart data ─────────────────────────────────────────── */

  const chartData = useMemo((): ChartRow[] => {
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

    const metricMeta: Record<string, { slope: number; intercept: number } | null> = {}
    for (const m of selectedMetrics) {
      const vals = sorted.map((r) => getMetricValue(r, m))
      const pairs = vals.map((v, i) => v !== null ? { x: i, y: v } : null).filter((p): p is { x: number; y: number } => p !== null)
      metricMeta[m] = linearRegression(pairs.map((p) => p.x), pairs.map((p) => p.y))
    }

    const rows = sorted.map((r, i): ChartRow => {
      const row: ChartRow = { date: r.date, runId: r.id }
      for (const m of selectedMetrics) {
        const v = getMetricValue(r, m)
        row[`v_${m}`] = v
        const reg = metricMeta[m]
        if (reg) row[`t_${m}`] = reg.slope * i + reg.intercept
      }
      return row
    })

    return rows.filter((r) => selectedMetrics.some((m) => r[`v_${m}`] != null))
  }, [filtered, selectedMetrics])

  /* ── Stats for primary metric ───────────────────────────── */

  const stats = useMemo(() => {
    const values = chartData.map((d) => d[`v_${primaryMetric}`] as number | null).filter((v): v is number => v !== null)
    if (values.length === 0) return null

    const lob       = LOWER_IS_BETTER[primaryMetric]
    const best      = lob ? Math.min(...values) : Math.max(...values)
    const worst     = lob ? Math.max(...values) : Math.min(...values)
    const avg       = values.reduce((s, v) => s + v, 0) / values.length
    const totalDist = filtered.reduce((s, r) => s + (r.total_distance ?? 0), 0)
    const reg       = linearRegression(values.map((_, i) => i), values)
    const range     = Math.max(...values) - Math.min(...values)
    const trend     = reg ? getTrendDir(reg.slope, range, primaryMetric) : "STABLE"

    // HR_EFFICIENCY: pace regression slope for runs with both pace + HR
    const paceHrRuns = filtered
      .filter((r) => parsePaceToSec(r.avg_pace) !== null && r.avg_hr !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
    const paceVals = paceHrRuns.map((r) => parsePaceToSec(r.avg_pace)!)
    const hrEff = linearRegression(paceVals.map((_, i) => i), paceVals)

    let hrEffStr = "--"
    if (hrEff && paceHrRuns.length >= 2) {
      const s = hrEff.slope
      hrEffStr = `${s >= 0 ? "+" : ""}${s.toFixed(2)} s/km/sess`
    }

    return { best, worst, avg, totalDist, trend, count: filtered.length, hrEffStr }
  }, [chartData, filtered, primaryMetric])

  const streak = useMemo(() => bestStreak(runs), [runs])

  /* ── Table sort ─────────────────────────────────────────── */

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => {
    let av: string | number | null, bv: string | number | null
    switch (sortKey) {
      case "avg_pace_sec":   av = parsePaceToSec(a.avg_pace);  bv = parsePaceToSec(b.avg_pace);  break
      case "date":           av = a.date;                       bv = b.date;                       break
      case "title":          av = a.title ?? "";                bv = b.title ?? "";                break
      case "total_distance": av = a.total_distance;             bv = b.total_distance;             break
      case "avg_hr":         av = a.avg_hr;                     bv = b.avg_hr;                     break
      case "avg_gct":        av = a.avg_gct;                    bv = b.avg_gct;                    break
      case "avg_cadence":    av = a.avg_cadence;                bv = b.avg_cadence;                break
      default:               av = a.compliance_score;           bv = b.compliance_score;           break
    }
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === "asc" ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

  /* ── Chart config ───────────────────────────────────────── */

  const xInterval  = Math.max(0, Math.floor(chartData.length / 6) - 1)
  const trendColor = stats?.trend === "IMPROVING" ? "var(--teal)" : stats?.trend === "DECLINING" ? "#e05252" : "var(--amber)"

  const SORT_COLS: { label: string; sk: SortKey }[] = [
    { label: "DATE",    sk: "date"            },
    { label: "TITLE",   sk: "title"           },
    { label: "DIST",    sk: "total_distance"  },
    { label: "PACE",    sk: "avg_pace_sec"    },
    { label: "HR",      sk: "avg_hr"          },
    { label: "GCT",     sk: "avg_gct"         },
    { label: "CADENCE", sk: "avg_cadence"     },
    { label: "COMPLY",  sk: "compliance_score"},
  ]

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)", minWidth: 960 }}>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--teal)]">PROGRESSION</span>
          <span className="label-caps text-[var(--on-surface-variant)]">:: PERFORMANCE_OVER_TIME</span>
        </div>
        <span className="label-caps text-[var(--on-surface-variant)]">{runs.length} TOTAL_SESSIONS</span>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-5 px-4 py-2 flex-shrink-0 flex-wrap"
        style={{
          borderBottom: "1px solid var(--outline-variant)",
          backgroundColor: "var(--surface-container-low)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">TYPE:</span>
          <select
            value={runType}
            onChange={(e) => setRunType(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "none",
              borderBottom: "1px solid var(--outline-variant)",
              minWidth: 90,
            }}
          >
            {RUN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">FROM:</span>
          <input
            type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 0, colorScheme: "dark", padding: "2px 6px",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">TO:</span>
          <input
            type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 0, colorScheme: "dark", padding: "2px 6px",
            }}
          />
        </div>

        {/* Multi-metric toggle — up to 3 */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="label-caps text-[var(--on-surface-variant)] mr-1">METRICS:</span>
          {METRICS.map(({ key, label }) => {
            const active = selectedMetrics.includes(key)
            const color  = METRIC_COLORS[key]
            return (
              <button
                key={key}
                onClick={() => toggleMetric(key)}
                className="label-caps transition-colors"
                style={{
                  padding: "2px 8px",
                  fontSize: 9,
                  border: `1px solid ${active ? color : "var(--outline-variant)"}`,
                  color:  active ? color : "var(--on-surface-variant)",
                  opacity: !active && selectedMetrics.length >= 3 ? 0.4 : 1,
                  cursor: !active && selectedMetrics.length >= 3 ? "not-allowed" : "pointer",
                }}
              >
                {label}
                {active && selectedMetrics.length > 1 && (
                  <span style={{ marginLeft: 3, opacity: 0.7 }}>
                    [{selectedMetrics.indexOf(key) + 1}]
                  </span>
                )}
              </button>
            )
          })}
          {selectedMetrics.length > 1 && (
            <span className="label-caps" style={{ fontSize: 9, color: "var(--on-surface-variant)", opacity: 0.5, marginLeft: 4 }}>
              STATS→[1]
            </span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">

        {/* ── PROGRESSION_CHART ───────────────────────────── */}
        <div
          className="flex-shrink-0 p-4"
          style={{ borderBottom: "1px solid var(--outline-variant)" }}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="label-caps text-[var(--on-surface-variant)]">PROGRESSION_CHART</span>
            <div className="flex items-center gap-4 flex-wrap">
              {selectedMetrics.map((m) => (
                <span key={m} className="label-caps" style={{ fontSize: 9, color: METRIC_COLORS[m] }}>
                  ─ {METRICS.find((x) => x.key === m)?.label}
                </span>
              ))}
              <span className="label-caps" style={{ fontSize: 9, color: "rgba(221,227,236,0.22)" }}>
                ╌ TREND
              </span>
            </div>
          </div>

          {chartData.length < 2 ? (
            <div className="flex items-center justify-center" style={{ height: 260 }}>
              <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.4 }}>
                {chartData.length === 0
                  ? "NO_DATA — adjust filters"
                  : "INSUFFICIENT_DATA — need ≥2 runs to plot progression"}
              </span>
            </div>
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: selectedMetrics.length > 1 ? 56 : 8, left: 50, bottom: 0 }}
                  onClick={(data) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const p = (data as any)?.activePayload?.[0]?.payload as ChartRow | undefined
                    if (p?.runId) router.push(`/dashboard/run-analysis/${p.runId as string}`)
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid
                    stroke="var(--surface-container-high)"
                    strokeDasharray=""
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    type="category"
                    interval={xInterval}
                    axisLine={{ stroke: "var(--outline-variant)" }}
                    tickLine={false}
                    tick={{ fill: "var(--on-surface-variant)", fontSize: 9, fontFamily: "var(--font-space-grotesk)" }}
                  />

                  {/* Y axes: left for [0], right for [1], hidden for [2] */}
                  {selectedMetrics.map((m, idx) => (
                    <YAxis
                      key={m}
                      yAxisId={m}
                      orientation={idx === 0 ? "left" : "right"}
                      hide={idx >= 2}
                      reversed={m === "AVG_PACE"}
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => yAxisFmt(v, m)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: METRIC_COLORS[m], fontSize: 9, fontFamily: "var(--font-space-grotesk)" }}
                      width={46}
                    />
                  ))}

                  <Tooltip
                    content={(props) => (
                      <ChartTooltip
                        active={props.active}
                        payload={props.payload as unknown as Array<{ payload: ChartRow; dataKey: string; value: number | null }>}
                        selectedMetrics={selectedMetrics}
                      />
                    )}
                    cursor={{ stroke: "var(--outline-variant)", strokeWidth: 1 }}
                  />

                  {/* Lines per metric: trend first (renders behind), then values */}
                  {selectedMetrics.map((m) => (
                    <Line
                      key={`t_${m}`}
                      yAxisId={m}
                      dataKey={`t_${m}`}
                      stroke={METRIC_COLORS[m]}
                      strokeOpacity={0.2}
                      strokeWidth={1}
                      strokeDasharray="5 4"
                      type="linear"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                  {selectedMetrics.map((m) => (
                    <Line
                      key={`v_${m}`}
                      yAxisId={m}
                      dataKey={`v_${m}`}
                      stroke={METRIC_COLORS[m]}
                      strokeWidth={1.5}
                      type="linear"
                      dot={{ r: 3.5, fill: METRIC_COLORS[m], stroke: "var(--surface-container)", strokeWidth: 1 }}
                      activeDot={{ r: 5.5, fill: METRIC_COLORS[m], stroke: "var(--surface)", strokeWidth: 1.5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── STATS_SUMMARY ────────────────────────────────── */}
        <div
          className="flex-shrink-0 p-4"
          style={{ borderBottom: "1px solid var(--outline-variant)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="label-caps text-[var(--on-surface-variant)]">STATS_SUMMARY</span>
            {selectedMetrics.length > 1 && (
              <span className="label-caps" style={{ fontSize: 9, color: METRIC_COLORS[primaryMetric] }}>
                [{METRICS.find((m) => m.key === primaryMetric)?.label}]
              </span>
            )}
          </div>
          {stats ? (
            <div className="flex items-stretch gap-2 flex-wrap">
              <StatCard label="BEST"       value={formatMetricValue(stats.best, primaryMetric)} />
              <StatCard label="WORST"      value={formatMetricValue(stats.worst, primaryMetric)} />
              <StatCard label="AVERAGE"    value={formatMetricValue(stats.avg, primaryMetric)} />
              <div style={{ width: 1, backgroundColor: "var(--outline-variant)", margin: "0 4px" }} />
              <StatCard label="RUNS_SHOWN" value={`${stats.count}`} />
              <StatCard label="TOTAL_DIST" value={`${stats.totalDist.toFixed(2)} km`} />
              <div style={{ width: 1, backgroundColor: "var(--outline-variant)", margin: "0 4px" }} />
              <StatCard label="TREND"       value={stats.trend}     color={trendColor} />
              <StatCard
                label="HR_EFFICIENCY"
                value={stats.hrEffStr}
                color={
                  stats.hrEffStr.startsWith("-") ? "var(--teal)"
                  : stats.hrEffStr === "--" ? "var(--on-surface-variant)"
                  : "#e05252"
                }
                sub="pace slope s/km/sess"
              />
              <StatCard label="BEST_STREAK" value={`${streak} days`} sub="all sessions" />
            </div>
          ) : (
            <span className="code-data text-[var(--on-surface-variant)]">NO_DATA</span>
          )}
        </div>

        {/* ── COMPARISON_TABLE ─────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col">
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface)]">COMPARISON_TABLE</span>
            <span className="label-caps text-[var(--on-surface-variant)]">
              {sortedFiltered.length} SESSIONS
            </span>
          </div>

          <div
            className="grid px-4 py-1.5 flex-shrink-0"
            style={{
              gridTemplateColumns: TABLE_COLS,
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            {SORT_COLS.map(({ label, sk }) => (
              <SortHeader key={sk} label={label} sk={sk} activeSk={sortKey} dir={sortDir} onSort={handleSort} />
            ))}
          </div>

          <div className="flex flex-col">
            {sortedFiltered.length === 0 ? (
              <div className="px-4 py-6">
                <span className="code-data text-[var(--on-surface-variant)]">
                  {runs.length === 0 ? "NO_SESSIONS — upload a run to get started" : "NO_RESULTS — adjust filters"}
                </span>
              </div>
            ) : (
              sortedFiltered.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-container)]"
                  style={{
                    gridTemplateColumns: TABLE_COLS,
                    borderBottom: "1px solid var(--outline-variant)",
                  }}
                  onClick={() => router.push(`/dashboard/run-analysis/${row.id}`)}
                >
                  <span className="code-data text-[var(--on-surface-variant)]">{row.date}</span>
                  <span className="code-data text-[var(--on-surface)] truncate pr-2" title={row.title ?? ""}>
                    {row.title ?? "--"}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">
                    {row.total_distance != null ? `${row.total_distance.toFixed(2)} km` : "--"}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">{row.avg_pace ?? "--"}</span>
                  <span className="code-data text-[var(--on-surface)]">
                    {row.avg_hr != null ? `${Math.round(row.avg_hr)}` : "--"}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">
                    {row.avg_gct != null ? `${Math.round(row.avg_gct)} ms` : "--"}
                  </span>
                  <span className="code-data text-[var(--on-surface)]">{row.avg_cadence ?? "--"}</span>
                  <div className="flex items-center">
                    <ComplianceDot score={row.compliance_score} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
