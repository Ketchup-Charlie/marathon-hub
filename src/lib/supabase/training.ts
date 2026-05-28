import { createClient } from "@/lib/supabase/server"

export type BlockInfo = {
  id: string
  name: string
  race_date: string
  start_date: string
}

export type MergedDayRow = {
  date: string
  dayType: "planned" | "rest" | "empty"
  workoutType: string
  targetDistKm: number | null
  actualDistKm: number | null
  targetPaceSec: number | null
  actualPaceStr: string | null
  avgHr: number | null
  durationSec: number | null
  runTypeTag: string | null
  comply: "green" | "amber" | "red" | "upcoming" | null
  segmentTarget: boolean
  secondaryType: string | null
  secondaryDescription: string | null
  description: string | null
}

/* ─── Low-level helpers ──────────────────────────────────── */

function parseIntervalToSec(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split(":").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

function parsePaceStr(pace: string | null | undefined): number | null {
  if (!pace) return null
  const [m, s] = pace.split(":").map(Number)
  if (isNaN(m) || isNaN(s)) return null
  return m * 60 + s
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function hasSegmentTarget(description: string | null | undefined): boolean {
  return description != null && /at MP/i.test(description)
}

/* ─── Per-metric score helpers ───────────────────────────── */

type Score = "green" | "amber" | "red"

// Merge two metric scores: green only if both green; red only if both red; else amber.
function mergeScores(a: Score, b: Score): Score {
  if (a === "green" && b === "green") return "green"
  if (a === "red"   && b === "red")   return "red"
  return "amber"
}

function distScoreThreshold(actual: number, target: number, greenPct: number, amberPct: number): Score {
  if (actual >= target * greenPct) return "green"
  if (actual >= target * amberPct) return "amber"
  return "red"
}

/* ─── Per-type compliance functions ─────────────────────── */

function complyEasy(
  targetDist: number, actualDist: number,
  metricType: string | null, minVal: string | null, maxVal: string | null,
  avgHr: number | null,
): Score {
  const distScore = distScoreThreshold(actualDist, targetDist, 1.0, 0.85)
  if (metricType !== "HR" || minVal == null || maxVal == null) return distScore
  const minHr = Number(minVal), maxHr = Number(maxVal)
  if (isNaN(minHr) || isNaN(maxHr)) return distScore
  const hrScore: Score = avgHr == null ? "red"
    : (avgHr >= minHr && avgHr <= maxHr)               ? "green"
    : (avgHr >= minHr * 0.9 && avgHr <= maxHr * 1.1)  ? "amber"
    : "red"
  return mergeScores(distScore, hrScore)
}

function complyTempo(
  targetDist: number, actualDist: number,
  metricType: string | null, minVal: string | null, maxVal: string | null,
  avgPace: string | null,
): Score {
  const distScore: Score = actualDist >= targetDist * 0.9 ? "green" : "red"
  if (metricType !== "Pace" || minVal == null || maxVal == null) return distScore
  const minSec = parsePaceStr(minVal), maxSec = parsePaceStr(maxVal), paceSec = parsePaceStr(avgPace)
  if (minSec == null || maxSec == null || paceSec == null) return distScore
  const paceScore: Score = (paceSec >= minSec && paceSec <= maxSec) ? "green" : "red"
  return mergeScores(distScore, paceScore)
}

function complyInterval(targetDist: number, actualDist: number): Score {
  const ratio = actualDist / targetDist
  return ratio >= 0.85 && ratio <= 1.15 ? "green" : "amber"
}

function complyLong(
  targetDist: number, actualDist: number,
  metricType: string | null, minVal: string | null, maxVal: string | null,
  avgHr: number | null,
): Score {
  const distScore = distScoreThreshold(actualDist, targetDist, 1.0, 0.85)
  if (metricType !== "HR" || minVal == null || maxVal == null) return distScore
  const minHr = Number(minVal), maxHr = Number(maxVal)
  if (isNaN(minHr) || isNaN(maxHr)) return distScore
  // Long run: AMBER only for drifting above max (up to 10%); below min or >10% above = red
  const hrScore: Score = avgHr == null ? "red"
    : (avgHr >= minHr && avgHr <= maxHr)              ? "green"
    : (avgHr > maxHr  && avgHr <= maxHr * 1.1)        ? "amber"
    : "red"
  return mergeScores(distScore, hrScore)
}

function complyRace(
  metricType: string | null, maxVal: string | null, avgPace: string | null,
): Score {
  if (metricType !== "Pace" || maxVal == null) return "green"
  const maxSec = parsePaceStr(maxVal), paceSec = parsePaceStr(avgPace)
  if (maxSec == null || paceSec == null) return "green"
  return paceSec <= maxSec * 1.1 ? "green" : "amber"
}

/* ─── Main compliance dispatcher ─────────────────────────── */

function computeComply(
  workoutType: string,
  targetDist: number | null,
  actualDist: number | null,
  metricType: string | null,
  minVal: string | null,
  maxVal: string | null,
  avgHr: number | null,
  avgPace: string | null,
  isFuture: boolean,
): "green" | "amber" | "red" | "upcoming" {
  if (isFuture) return "upcoming"

  if (workoutType === "Rest") {
    return actualDist == null ? "green" : "red"
  }
  if (workoutType === "Strength") {
    return actualDist == null ? "green" : "amber"
  }

  if (workoutType === "Race") {
    if (actualDist == null) return "red"
    return complyRace(metricType, maxVal, avgPace)
  }

  if (actualDist == null) return "red"

  const td = targetDist ?? actualDist  // graceful fallback if no target distance
  if (workoutType === "Easy")     return complyEasy(td, actualDist, metricType, minVal, maxVal, avgHr)
  if (workoutType === "Tempo")    return complyTempo(td, actualDist, metricType, minVal, maxVal, avgPace)
  if (workoutType === "Interval") return complyInterval(td, actualDist)
  if (workoutType === "Long")     return complyLong(td, actualDist, metricType, minVal, maxVal, avgHr)

  // Generic fallback
  const ratio = actualDist / td
  return ratio >= 0.9 ? "green" : ratio >= 0.8 ? "amber" : "red"
}

/* ─── Fetch helpers ──────────────────────────────────────── */

export async function getPlannedWorkouts(blockId: string, fromDate: string, toDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("id, date, workout_type, description, target_distance_km, target_metric_type, target_metric_min, target_metric_max, secondary_type, secondary_description")
    .eq("block_id", blockId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date")
  if (error) throw error
  return data ?? []
}

export async function getCompletedRuns(userId: string, fromDate: string, toDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("completed_runs")
    .select("id, date, total_distance, total_time, avg_pace, avg_hr, run_type_tag")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date")
  if (error) throw error
  return data ?? []
}

/* ─── 15-day merge ───────────────────────────────────────── */

export async function mergeWeekData(
  blockId: string,
  userId: string,
): Promise<MergedDayRow[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr   = toDateStr(today)
  const windowStart = addDays(today, -7)
  const windowEnd   = addDays(today, +7)
  const fromDate   = toDateStr(windowStart)
  const toDate     = toDateStr(windowEnd)

  const [planned, completed] = await Promise.all([
    getPlannedWorkouts(blockId, fromDate, toDate),
    getCompletedRuns(userId, fromDate, toDate),
  ])

  const plannedByDate   = new Map(planned.map((p) => [p.date, p]))
  const completedByDate = new Map(completed.map((r) => [r.date, r]))

  return Array.from({ length: 15 }, (_, i) => {
    const date = toDateStr(addDays(windowStart, i))
    const pw   = plannedByDate.get(date) ?? null
    const run  = completedByDate.get(date) ?? null

    if (!pw) {
      return {
        date,
        dayType:             "empty",
        workoutType:         run?.run_type_tag ?? "",
        targetDistKm:        null,
        actualDistKm:        run?.total_distance ?? null,
        targetPaceSec:       null,
        actualPaceStr:       run?.avg_pace ?? null,
        avgHr:               run?.avg_hr ?? null,
        durationSec:         null,
        runTypeTag:          run?.run_type_tag ?? null,
        comply:              null,
        segmentTarget:       false,
        secondaryType:       null,
        secondaryDescription: null,
        description:         null,
      } satisfies MergedDayRow
    }

    const isFuture = date > todayStr
    const dayType: "planned" | "rest" =
      pw.workout_type === "Rest" ? "rest" : "planned"

    let targetPaceSec: number | null = null
    if (pw.target_metric_type === "Pace") {
      const minSec = parsePaceStr(pw.target_metric_min)
      const maxSec = parsePaceStr(pw.target_metric_max)
      if (minSec != null && maxSec != null) targetPaceSec = (minSec + maxSec) / 2
    }

    return {
      date,
      dayType,
      workoutType:   pw.workout_type,
      targetDistKm:  pw.target_distance_km ?? null,
      actualDistKm:  run?.total_distance ?? null,
      targetPaceSec,
      actualPaceStr: run?.avg_pace ?? null,
      avgHr:         run?.avg_hr ?? null,
      durationSec:   parseIntervalToSec(run?.total_time ?? null),
      runTypeTag:    run?.run_type_tag ?? null,
      comply: computeComply(
        pw.workout_type,
        pw.target_distance_km ?? null,
        run?.total_distance ?? null,
        pw.target_metric_type ?? null,
        pw.target_metric_min ?? null,
        pw.target_metric_max ?? null,
        run?.avg_hr ?? null,
        run?.avg_pace ?? null,
        isFuture,
      ),
      segmentTarget:       hasSegmentTarget(pw.description),
      secondaryType:       (pw as { secondary_type?: string | null }).secondary_type ?? null,
      secondaryDescription: (pw as { secondary_description?: string | null }).secondary_description ?? null,
      description:         pw.description ?? null,
    } satisfies MergedDayRow
  })
}
