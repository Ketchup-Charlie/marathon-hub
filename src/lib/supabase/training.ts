import { createClient } from "@/lib/supabase/server"

export type BlockInfo = {
  id: string
  name: string
  race_date: string
  start_date: string
}

export type MergedDayRow = {
  date: string
  workoutType: string
  targetDistKm: number
  actualDistKm: number | null
  targetPaceSec: number | null
  actualPaceStr: string | null
  avgHr: number | null
  comply: "full" | "partial" | "upcoming"
}

function parsePaceStr(pace: string | null): number | null {
  if (!pace) return null
  const [m, s] = pace.split(":").map(Number)
  if (isNaN(m) || isNaN(s)) return null
  return m * 60 + s
}

function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function computeComply(
  targetDistKm: number,
  actualDistKm: number | null,
  targetPaceSec: number | null,
  actualPaceStr: string | null
): "full" | "partial" | "upcoming" {
  if (actualDistKm === null) return "upcoming"

  const distOk = Math.abs(actualDistKm - targetDistKm) / targetDistKm <= 0.1

  let paceOk = true
  if (targetPaceSec !== null) {
    const actualPaceSec = parsePaceStr(actualPaceStr)
    if (actualPaceSec !== null) {
      paceOk = Math.abs(actualPaceSec - targetPaceSec) / targetPaceSec <= 0.1
    }
  }

  return distOk && paceOk ? "full" : "partial"
}

export async function getPlannedWorkouts(blockId: string, weekStart: Date) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("id, date, workout_type, target_distance_km, target_metric_type, target_metric_min, target_metric_max")
    .eq("block_id", blockId)
    .in("date", getWeekDates(weekStart))
    .order("date")
  if (error) throw error
  return data ?? []
}

export async function getCompletedRuns(userId: string, from: Date, to: Date) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("completed_runs")
    .select("id, date, total_distance, avg_pace, avg_hr")
    .eq("user_id", userId)
    .gte("date", from.toISOString().slice(0, 10))
    .lte("date", to.toISOString().slice(0, 10))
    .order("date")
  if (error) throw error
  return data ?? []
}

export async function mergeWeekData(
  blockId: string,
  userId: string,
  weekStart: Date
): Promise<MergedDayRow[]> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const [planned, completed] = await Promise.all([
    getPlannedWorkouts(blockId, weekStart),
    getCompletedRuns(userId, weekStart, weekEnd),
  ])

  const completedByDate = new Map(completed.map((r) => [r.date, r]))

  return planned.map((pw) => {
    const run = completedByDate.get(pw.date) ?? null

    let targetPaceSec: number | null = null
    if (pw.target_metric_type === "Pace") {
      const minSec = parsePaceStr(pw.target_metric_min)
      const maxSec = parsePaceStr(pw.target_metric_max)
      if (minSec != null && maxSec != null) targetPaceSec = (minSec + maxSec) / 2
    }

    return {
      date: pw.date,
      workoutType: pw.workout_type,
      targetDistKm: pw.target_distance_km,
      actualDistKm: run?.total_distance ?? null,
      targetPaceSec,
      actualPaceStr: run?.avg_pace ?? null,
      avgHr: run?.avg_hr ?? null,
      comply: computeComply(
        pw.target_distance_km,
        run?.total_distance ?? null,
        targetPaceSec,
        run?.avg_pace ?? null
      ),
    }
  })
}
