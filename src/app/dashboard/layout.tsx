import { getMetricsSummary } from "@/lib/hermes"
import { createClient } from "@/lib/supabase/server"
import DashboardShell from "./DashboardShell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [metrics, raceConfigResult] = await Promise.all([
    getMetricsSummary().catch(() => null),
    user
      ? supabase
          .from("race_config")
          .select("target_time")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <DashboardShell
      readinessLevel={metrics?.readiness_level ?? null}
      readinessScore={metrics?.readiness_score ?? null}
      raceConfig={raceConfigResult.data ?? null}
    >
      {children}
    </DashboardShell>
  )
}
