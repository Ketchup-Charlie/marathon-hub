import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getMetricsSummary,
  getHrvTrend,
  getSleepTrend,
  getReadinessTrend,
  type MetricsSummary,
  type HrvTrendPoint,
  type SleepTrendPoint,
  type ReadinessTrendPoint,
} from '@/lib/hermes'
import BiometricLogClient from './BiometricLogClient'

export default async function BiometricLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let summary:        MetricsSummary | null  = null
  let hrvTrend:       HrvTrendPoint[]        = []
  let sleepTrend:     SleepTrendPoint[]      = []
  let readinessTrend: ReadinessTrendPoint[]  = []

  try { summary        = await getMetricsSummary()  } catch (e) { console.error('[biometric-log] summary failed:', e)        }
  try { hrvTrend       = await getHrvTrend()         } catch (e) { console.error('[biometric-log] hrv-trend failed:', e)      }
  try { sleepTrend     = await getSleepTrend()       } catch (e) { console.error('[biometric-log] sleep-trend failed:', e)    }
  try { readinessTrend = await getReadinessTrend()   } catch (e) { console.error('[biometric-log] readiness-trend failed:', e) }

  return (
    <BiometricLogClient
      summary={summary}
      hrvTrend={hrvTrend}
      sleepTrend={sleepTrend}
      readinessTrend={readinessTrend}
    />
  )
}
