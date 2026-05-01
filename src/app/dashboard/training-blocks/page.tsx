import { createClient } from "@/lib/supabase/server"
import { getMetricsSummary, getConsistencyData } from "@/lib/hermes"
import type { MomentumDay } from "@/lib/hermes"
import { mergeWeekData } from "@/lib/supabase/training"
import TrainingPlanClient from "./TrainingPlanClient"

const AEST_TZ = "Australia/Sydney"

/** Convert a Hermes UTC date string (e.g. "2025-05-01") to the AEST calendar date. */
function hermesToAEST(utcDateStr: string): string {
  return new Date(utcDateStr + "T00:00:00Z")
    .toLocaleDateString("en-CA", { timeZone: AEST_TZ })
}

/** Today's date in AEST as YYYY-MM-DD. */
function todayAEST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AEST_TZ })
}

/** Add (or subtract) days from a YYYY-MM-DD string without DST ambiguity. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export default async function TrainingBlocksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const metrics = await getMetricsSummary().catch(() => null)

  if (!user) {
    return <TrainingPlanClient metrics={metrics} weekData={null} noBlock raceConfig={null} momentumDays={[]} />
  }

  const todayStr  = todayAEST()
  const cutoffStr = addDays(todayStr, -83)

  const [blocksResult, rcResult] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, name, race_date, start_date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("race_config")
      .select("race_name, race_date")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const block = blocksResult.data?.[0] ?? null
  const raceConfig = rcResult.data ?? null

  const [consistencyRaw, runsResult, plannedResult, weekData] = await Promise.all([
    getConsistencyData().catch(() => []),
    supabase
      .from("completed_runs")
      .select("date, compliance_score")
      .eq("user_id", user.id)
      .gte("date", cutoffStr)
      .lte("date", todayStr),
    block
      ? supabase
          .from("planned_workouts")
          .select("date, workout_type")
          .eq("block_id", block.id)
          .gte("date", cutoffStr)
          .lte("date", todayStr)
          .not("workout_type", "in", '("Rest","Strength")')
      : Promise.resolve({ data: [] }),
    block
      ? mergeWeekData(block.id, user.id).catch(() => [])
      : Promise.resolve([]),
  ])

  const runDistMap = new Map(
    consistencyRaw.map((d) => [hermesToAEST(d.date), d.total_distance_km])
  )
  const supabaseRunDates = new Set((runsResult.data ?? []).map((r) => r.date))
  const complianceMap = new Map(
    (runsResult.data ?? []).map((r) => [r.date, r.compliance_score as string | null])
  )
  const plannedDates = new Set((plannedResult.data ?? []).map((p) => p.date))

  const momentumDays: MomentumDay[] = Array.from({ length: 84 }, (_, i) => {
    const date   = addDays(todayStr, -i)
    const hasRun = (runDistMap.get(date) ?? 0) > 0 || supabaseRunDates.has(date)
    const score  = complianceMap.get(date) ?? null
    return {
      date,
      hasRun,
      isAmber:    score === "Yellow" || score === "Red",
      hasPlanned: plannedDates.has(date),
    }
  })

  if (!block) {
    return (
      <TrainingPlanClient
        metrics={metrics}
        weekData={null}
        noBlock
        block={null}
        raceConfig={raceConfig}
        momentumDays={momentumDays}
      />
    )
  }

  return (
    <TrainingPlanClient
      metrics={metrics}
      weekData={weekData}
      noBlock={false}
      block={block}
      raceConfig={raceConfig}
      momentumDays={momentumDays}
    />
  )
}
