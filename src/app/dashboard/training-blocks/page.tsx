import { getMetricsSummary } from "@/lib/hermes"
import TrainingPlanClient from "./TrainingPlanClient"

export default async function TrainingBlocksPage() {
  const metrics = await getMetricsSummary().catch(() => null)
  return <TrainingPlanClient metrics={metrics} />
}
