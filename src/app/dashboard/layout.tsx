import { getMetricsSummary } from "@/lib/hermes"
import DashboardShell from "./DashboardShell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const metrics = await getMetricsSummary().catch(() => null)
  return (
    <DashboardShell
      readinessLevel={metrics?.readiness_level ?? null}
      readinessScore={metrics?.readiness_score ?? null}
    >
      {children}
    </DashboardShell>
  )
}
