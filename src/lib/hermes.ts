import { createClient as createSupabaseClient } from '@/lib/supabase/server'

const BASE        = process.env.HERMES_API_URL
const KEY         = process.env.HERMES_API_KEY
const OWNER_EMAIL = process.env.HERMES_OWNER_EMAIL

async function isOwner(): Promise<boolean> {
  if (!OWNER_EMAIL) return false
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === OWNER_EMAIL
}

/* ─── Raw API shapes ────────────────────────────────────── */

type HermesRaw = {
  hrv: {
    avg_overnight_hrv: number
    sleep_score:       number
  }
  readiness: {
    readiness_score: number
    level:           "HIGH" | "MODERATE" | "LOW"
  }
  mechanics: {
    avg_gct:              number
    avg_running_cadence:  number
    avg_vertical_ratio:   number
  }
}

type ConsistencyRaw = {
  daily_running: { date: string; total_distance_km: number }[]
}

type HrvTrendRaw = {
  hrv_trend?: { date: string; avg_overnight_hrv: number; sleep_score: number | null }[]
  data?:      { date: string; avg_overnight_hrv: number; sleep_score: number | null }[]
}

type SleepTrendRaw = {
  sleep_trend?: SleepTrendPoint[]
  data?:        SleepTrendPoint[]
}

type ReadinessTrendRaw = {
  readiness_trend?: ReadinessTrendPoint[]
  data?:            ReadinessTrendPoint[]
}

/* ─── Public types ──────────────────────────────────────── */

export type MetricsSummary = {
  hrv_baseline_ms:    number
  sleep_score:        number
  readiness_score:    number
  readiness_level:    "HIGH" | "MODERATE" | "LOW"
  cadence_avg_spm:    number
  avg_gct_ms:         number
  avg_vertical_ratio: number
}

export type MomentumDay = {
  date:        string
  hasRun:      boolean
  isAmber:     boolean
  hasPlanned:  boolean
}

export type HrvTrendPoint = {
  date?:             string
  sleep_date?:       string
  avg_overnight_hrv: number
  sleep_score:       number | null
}

export type SleepTrendPoint = {
  sleep_date:          string
  total_sleep_minutes: number | null
  rem_sleep_minutes:   number | null
  deep_sleep_minutes:  number | null
  avg_overnight_hrv:   number | null
  sleep_score:         number | null
  resting_heart_rate:  number | null
}

export type ReadinessTrendPoint = {
  date:                        string
  readiness_score:             number | null
  level:                       "HIGH" | "MODERATE" | "LOW" | null
  hrv_factor_feedback:         string | null
  sleep_score_factor_feedback: string | null
}

/* ─── Fetcher ───────────────────────────────────────────── */

async function hermesFetch<T>(path: string): Promise<T> {
  if (!BASE || !KEY) throw new Error("HERMES_API_URL / HERMES_API_KEY not configured")
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": KEY },
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Hermes ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

/* ─── Endpoints ─────────────────────────────────────────── */

export async function getMetricsSummary(): Promise<MetricsSummary | null> {
  if (!(await isOwner())) return null
  const raw = await hermesFetch<HermesRaw>("/metrics/summary")
  return {
    hrv_baseline_ms:    raw.hrv.avg_overnight_hrv,
    sleep_score:        raw.hrv.sleep_score,
    readiness_score:    raw.readiness.readiness_score,
    readiness_level:    raw.readiness.level,
    cadence_avg_spm:    raw.mechanics.avg_running_cadence,
    avg_gct_ms:         raw.mechanics.avg_gct,
    avg_vertical_ratio: raw.mechanics.avg_vertical_ratio,
  }
}

export async function getConsistencyData(): Promise<{ date: string; total_distance_km: number }[]> {
  if (!(await isOwner())) return []
  const raw = await hermesFetch<ConsistencyRaw>("/metrics/consistency")
  return raw.daily_running ?? []
}

export async function getHrvTrend(): Promise<HrvTrendPoint[]> {
  if (!(await isOwner())) return []
  const raw = await hermesFetch<HrvTrendRaw>("/metrics/hrv-trend")
  return (raw.hrv_trend ?? raw.data ?? []) as HrvTrendPoint[]
}

export async function getSleepTrend(): Promise<SleepTrendPoint[]> {
  if (!(await isOwner())) return []
  const raw = await hermesFetch<SleepTrendRaw>("/metrics/sleep-trend")
  return raw.data ?? raw.sleep_trend ?? []
}

export async function getReadinessTrend(): Promise<ReadinessTrendPoint[]> {
  if (!(await isOwner())) return []
  const raw = await hermesFetch<ReadinessTrendRaw>("/metrics/readiness-trend")
  return raw.data ?? raw.readiness_trend ?? []
}

export type TrainingLoadPoint = {
  date:         string
  acute_load:   number | null
  chronic_load: number | null
  load_ratio:   number | null
  acwr_status:  string | null
}

type TrainingLoadRaw = {
  data?:          TrainingLoadPoint[]
  training_load?: TrainingLoadPoint[]
}

export async function getTrainingLoadTrend(): Promise<TrainingLoadPoint[]> {
  if (!(await isOwner())) return []
  const raw = await hermesFetch<TrainingLoadRaw>("/metrics/training-load")
  return raw.data ?? raw.training_load ?? []
}
