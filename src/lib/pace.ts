export function parseHMS(s: string): number | null {
  const parts = s.split(":").map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function fmtPace(secPerKm: number): string {
  let m = Math.floor(secPerKm / 60)
  let s = Math.round(secPerKm % 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, "0")}`
}

export function calcPaces(targetTime: string): { mp: string; tempo: string; int: string; easy: string } | null {
  const total = parseHMS(targetTime)
  if (!total) return null
  const mp = total / 42.195
  return {
    mp:    fmtPace(mp),
    tempo: fmtPace(mp - 18),
    int:   fmtPace(mp - 43),
    easy:  fmtPace(mp + 57),
  }
}
