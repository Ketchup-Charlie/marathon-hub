import { createClient } from "@/lib/supabase/server"
import { getMetricsSummary } from "@/lib/hermes"
import { mergeWeekData } from "@/lib/supabase/training"
import TrainingPlanClient from "./TrainingPlanClient"

export default async function TrainingBlocksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const metrics = await getMetricsSummary().catch(() => null)

  if (!user) {
    return <TrainingPlanClient metrics={metrics} weekData={null} noBlock raceConfig={null} />
  }

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

  if (!block) {
    return <TrainingPlanClient metrics={metrics} weekData={null} noBlock block={null} raceConfig={raceConfig} />
  }

  const weekData = await mergeWeekData(block.id, user.id).catch(() => [])

  return (
    <TrainingPlanClient
      metrics={metrics}
      weekData={weekData}
      noBlock={false}
      block={block}
      raceConfig={raceConfig}
    />
  )
}
