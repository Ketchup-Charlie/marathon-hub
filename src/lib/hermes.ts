const BASE = process.env.HERMES_API_URL
const KEY  = process.env.HERMES_API_KEY

/* ─── Raw API shape ─────────────────────────────────────── */

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

/* ─── Public type ───────────────────────────────────────── */

export type MetricsSummary = {
  hrv_baseline_ms:    number
  sleep_score:        number
  readiness_score:    number
  readiness_level:    "HIGH" | "MODERATE" | "LOW"
  cadence_avg_spm:    number
  avg_gct_ms:         number
  avg_vertical_ratio: number
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

export async function getMetricsSummary(): Promise<MetricsSummary> {
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
