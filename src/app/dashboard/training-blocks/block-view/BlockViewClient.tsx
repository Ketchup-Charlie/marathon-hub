"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'

/* ─── Types ──────────────────────────────────────────────── */

type Block = {
  id: string
  name: string
  race_date: string
  start_date: string
  total_weeks: number
  week_phases: Record<string, string>
}

type Workout = {
  id: string
  date: string
  workout_type: string
  description: string | null
  target_distance_km: number | null
  target_metric_type: string | null
  target_metric_min: string | null
  target_metric_max: string | null
  schedule_status: string
}

type ModalState = {
  open: boolean
  date: string
  weekNum: number
  existing: Workout | null
}

type FormState = {
  workout_type: string
  target_distance_km: string
  target_metric_type: string
  target_metric_min: string
  target_metric_max: string
  description: string
  phase: string
}

/* ─── Constants ──────────────────────────────────────────── */

const TYPE_COLOR: Record<string, string> = {
  Easy:     'var(--teal)',
  Tempo:    'var(--amber)',
  Interval: '#ffb300',
  Long:     '#c084fc',
  Race:     'var(--amber)',
  Strength: 'var(--on-surface-variant)',
  Rest:     'var(--surface-container-highest)',
}

const WORKOUT_TYPES = ['Easy', 'Long', 'Tempo', 'Interval', 'Race', 'Strength', 'Rest']
const METRIC_TYPES  = ['Pace', 'HR', 'RPE']
const PHASE_TYPES   = ['BASE', 'BUILD', 'PEAK', 'TAPER', 'RACE']

const EMPTY_FORM: FormState = {
  workout_type:       'Easy',
  target_distance_km: '',
  target_metric_type: 'HR',
  target_metric_min:  '',
  target_metric_max:  '',
  description:        '',
  phase:              'BASE',
}

/* ─── Helpers ────────────────────────────────────────────── */

function parseLocalDate(str: string): Date {
  return new Date(str + 'T00:00:00')
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtRange(weekMon: Date): string {
  const sun    = addDays(weekMon, 6)
  const mMonth = weekMon.toLocaleDateString('en-US', { month: 'short' })
  const sMonth = sun.toLocaleDateString('en-US', { month: 'short' })
  if (mMonth === sMonth) return `${mMonth} ${weekMon.getDate()}–${sun.getDate()}`
  return `${mMonth} ${weekMon.getDate()}–${sMonth} ${sun.getDate()}`
}

function fmtDist(km: number): string {
  return `${km % 1 === 0 ? km : km.toFixed(1)}k`
}

// Dynamic phase formula for any plan length N.
// Fixed suffix: RACE(N), TAPER(N-1, N-2), PEAK(N-3, N-4).
// Remaining weeks 1..N-5 split evenly: first ⌈n/2⌉ = BASE, rest = BUILD.
// overrides map (week key → phase) wins over calculated phase.
function getPhase(w: number, totalWeeks: number, overrides: Record<string, string> = {}): string {
  if (overrides[String(w)]) return overrides[String(w)]
  if (w === totalWeeks)     return 'RACE'
  if (w === totalWeeks - 1) return 'TAPER'
  if (w === totalWeeks - 2) return 'TAPER'
  if (w === totalWeeks - 3) return 'PEAK'
  if (w === totalWeeks - 4) return 'PEAK'
  const remaining = totalWeeks - 5
  if (remaining <= 0) return 'BASE'
  const halfPoint = Math.ceil(remaining / 2)
  return w <= halfPoint ? 'BASE' : 'BUILD'
}

function getCurrentWeekNum(startDate: Date, totalWeeks: number): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let w = 1; w <= totalWeeks; w++) {
    const mon = addDays(startDate, 1 + (w - 1) * 7)
    const sun = addDays(mon, 6)
    if (today >= mon && today <= sun) return w
  }
  return today < addDays(startDate, 1) ? 1 : totalWeeks
}

/* ─── Sub-components ─────────────────────────────────────── */

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="label-caps"
      style={{ color: TYPE_COLOR[type] ?? 'var(--on-surface-variant)', fontSize: 9, letterSpacing: '0.08em' }}
    >
      {type.toUpperCase()}
    </span>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function BlockViewClient({
  block,
  workouts: initialWorkouts,
}: {
  block: Block
  workouts: Workout[]
}) {
  const startDate = useMemo(() => parseLocalDate(block.start_date), [block.start_date])

  const [workouts, setWorkouts]     = useState<Workout[]>(initialWorkouts)
  const [weekPhases, setWeekPhases] = useState<Record<string, string>>(block.week_phases)
  const [modal, setModal]           = useState<ModalState>({ open: false, date: '', weekNum: 1, existing: null })
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout>()
    workouts.forEach(w => map.set(w.date, w))
    return map
  }, [workouts])

  const currentWeekNum = useMemo(
    () => getCurrentWeekNum(startDate, block.total_weeks),
    [startDate, block.total_weeks]
  )

  const todayStr = toDateStr(new Date())

  const raceDateFmt = parseLocalDate(block.race_date)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase()

  /* ── Week rows ─────────────────────────────────────────── */

  const weeks = useMemo(
    () =>
      Array.from({ length: block.total_weeks }, (_, i) => {
        const w    = i + 1
        const mon  = addDays(startDate, 1 + i * 7)
        const days = Array.from({ length: 7 }, (_, d) => addDays(mon, d))
        return { w, mon, days, phase: getPhase(w, block.total_weeks, weekPhases) }
      }),
    [startDate, block.total_weeks, weekPhases]
  )

  /* ── Modal handlers ────────────────────────────────────── */

  function openModal(date: string, weekNum: number) {
    const existing     = workoutsByDate.get(date) ?? null
    const currentPhase = weekPhases[String(weekNum)] ?? getPhase(weekNum, block.total_weeks)
    setModal({ open: true, date, weekNum, existing })
    setForm(
      existing
        ? {
            workout_type:       existing.workout_type,
            target_distance_km: existing.target_distance_km?.toString() ?? '',
            target_metric_type: existing.target_metric_type ?? 'HR',
            target_metric_min:  existing.target_metric_min ?? '',
            target_metric_max:  existing.target_metric_max ?? '',
            description:        existing.description ?? '',
            phase:              currentPhase,
          }
        : { ...EMPTY_FORM, phase: currentPhase }
    )
    setSaveError(null)
  }

  function closeModal() {
    setModal(m => ({ ...m, open: false }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      /* ── Workout save ──────────────────────────────────── */
      const payload = {
        workout_type:       form.workout_type,
        description:        form.description || null,
        target_distance_km: form.target_distance_km ? parseFloat(form.target_distance_km) : null,
        target_metric_type: form.target_metric_type || null,
        target_metric_min:  form.target_metric_min || null,
        target_metric_max:  form.target_metric_max || null,
      }

      const res = await fetch('/api/workouts', {
        method:  modal.existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(
          modal.existing
            ? { id: modal.existing.id, ...payload }
            : { block_id: block.id, date: modal.date, ...payload }
        ),
      })

      if (!res.ok) {
        const { error } = await res.json()
        setSaveError(error ?? 'Save failed')
        return
      }

      const saved: Workout = await res.json()
      setWorkouts(prev =>
        [...prev.filter(w => w.id !== saved.id), saved].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      )

      /* ── Phase override save ───────────────────────────── */
      const weekKey      = String(modal.weekNum)
      const calcPhase    = getPhase(modal.weekNum, block.total_weeks)
      const prevEffective = weekPhases[weekKey] ?? calcPhase

      if (form.phase !== prevEffective) {
        const newPhases = { ...weekPhases }
        if (form.phase !== calcPhase) {
          newPhases[weekKey] = form.phase
        } else {
          delete newPhases[weekKey]
        }
        const blkRes = await fetch('/api/blocks', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id: block.id, week_phases: newPhases }),
        })
        if (!blkRes.ok) {
          const { error } = await blkRes.json()
          setSaveError(error ?? 'Phase save failed')
          return
        }
        setWeekPhases(newPhases)
      }

      closeModal()
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface)', overflow: 'hidden' }}>

      {/* ── Page header ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-4"
        style={{
          height: 44,
          backgroundColor: 'var(--surface-container-low)',
          borderBottom: '1px solid var(--outline-variant)',
        }}
      >
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard/training-blocks"
            className="label-caps text-[var(--on-surface-variant)] hover:text-[var(--teal)]"
            style={{ textDecoration: 'none' }}
          >
            ← WEEK_VIEW
          </Link>
          <span className="label-caps text-[var(--on-surface)]">{block.name.toUpperCase()}</span>
          <span className="label-caps text-[var(--on-surface-variant)]">
            RACE:{' '}
            <span className="text-[var(--teal)]">{raceDateFmt}</span>
          </span>
          <span className="label-caps text-[var(--on-surface-variant)]">
            {block.total_weeks}_WEEKS
          </span>
        </div>
        <span className="label-caps text-[var(--on-surface-variant)]">BLOCK_VIEW</span>
      </div>

      {/* ── Column header row ────────────────────────────── */}
      <div
        className="flex-shrink-0 grid px-4 py-1.5"
        style={{
          gridTemplateColumns: '44px 52px 100px repeat(7, 1fr)',
          backgroundColor: 'var(--surface-container-low)',
          borderBottom: '1px solid var(--outline-variant)',
        }}
      >
        <div /><div /><div />
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
          <span key={d} className="label-caps text-[var(--on-surface-variant)] text-center">{d}</span>
        ))}
      </div>

      {/* ── Week rows ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {weeks.map(({ w, mon, days, phase }) => {
          const isCurrent = w === currentWeekNum
          return (
            <div
              key={w}
              className="grid"
              style={{
                gridTemplateColumns: '44px 52px 100px repeat(7, 1fr)',
                borderBottom: '1px solid var(--outline-variant)',
                borderLeft: `2px solid ${isCurrent ? 'var(--teal)' : 'transparent'}`,
                backgroundColor: isCurrent ? 'var(--surface-container-low)' : 'transparent',
                minHeight: 72,
                paddingLeft: 14,
              }}
            >
              {/* W# */}
              <div
                className="flex items-center"
                style={{ borderRight: '1px solid var(--outline-variant)', paddingRight: 8 }}
              >
                <span
                  className="label-caps"
                  style={{ color: isCurrent ? 'var(--teal)' : 'var(--on-surface-variant)' }}
                >
                  W{w}
                </span>
              </div>

              {/* PHASE */}
              <div
                className="flex items-center px-2"
                style={{ borderRight: '1px solid var(--outline-variant)' }}
              >
                <span
                  className="label-caps"
                  style={{
                    fontSize: 9,
                    color:      phase === 'RACE' ? 'var(--amber)' : 'var(--on-surface-variant)',
                    fontWeight: phase === 'RACE' ? 700 : undefined,
                  }}
                >
                  {phase}
                </span>
              </div>

              {/* DATE RANGE */}
              <div
                className="flex items-center px-2"
                style={{ borderRight: '1px solid var(--outline-variant)' }}
              >
                <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11 }}>
                  {fmtRange(mon)}
                </span>
              </div>

              {/* Day cells */}
              {days.map((day, di) => {
                const dateStr = toDateStr(day)
                const workout = workoutsByDate.get(dateStr)
                const isToday = dateStr === todayStr
                const isRace  = workout?.workout_type === 'Race'
                return (
                  <div
                    key={di}
                    className="relative group flex flex-col justify-center px-2 py-2 cursor-pointer hover:bg-[var(--surface-container-high)]"
                    style={{
                      borderRight:     di < 6 ? '1px solid var(--outline-variant)' : undefined,
                      borderTop:       isToday ? '2px solid var(--teal)' : undefined,
                      minHeight:       72,
                      ...(isRace ? {
                        boxShadow:       '0 0 0 1px var(--amber), 0 0 12px rgba(255,179,0,0.18)',
                        backgroundColor: 'rgba(255,179,0,0.04)',
                      } : {}),
                    }}
                    onClick={() => openModal(dateStr, w)}
                  >
                    {workout ? (
                      <>
                        {isRace ? (
                          <>
                            <span
                              className="label-caps font-bold"
                              style={{ color: 'var(--amber)', fontSize: 9, letterSpacing: '0.08em' }}
                            >
                              🏁 RACE
                            </span>
                            {workout.target_distance_km != null && (
                              <span
                                className="code-data font-bold mt-0.5"
                                style={{ color: 'var(--amber)', fontSize: 12 }}
                              >
                                {fmtDist(workout.target_distance_km)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <TypeBadge type={workout.workout_type} />
                            {workout.target_distance_km != null && (
                              <span
                                className="code-data text-[var(--on-surface)] mt-0.5"
                                style={{ fontSize: 12 }}
                              >
                                {fmtDist(workout.target_distance_km)}
                              </span>
                            )}
                            {workout.target_metric_type &&
                              workout.target_metric_min &&
                              workout.target_metric_max && (
                                <span
                                  className="code-data text-[var(--on-surface-variant)] mt-0.5"
                                  style={{ fontSize: 10 }}
                                >
                                  {workout.target_metric_type === 'Pace'
                                    ? `${workout.target_metric_min}–${workout.target_metric_max}`
                                    : `${workout.target_metric_min}–${workout.target_metric_max}bpm`}
                                </span>
                              )}
                          </>
                        )}

                        {/* Description tooltip — below for W1 to avoid clipping by scroll edge */}
                        {workout.description && (
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 hidden group-hover:block z-20 pointer-events-none whitespace-nowrap ${w === 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
                            style={{
                              backgroundColor: 'var(--surface-container-lowest)',
                              border:          `1px solid ${isRace ? 'var(--amber)' : 'var(--teal)'}`,
                              padding:         '4px 8px',
                            }}
                          >
                            <span className="code-data text-[var(--on-surface)]" style={{ fontSize: 11 }}>
                              {workout.description}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span
                        className="label-caps text-center"
                        style={{ color: 'var(--surface-container-highest)', fontSize: 14 }}
                      >
                        +
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Edit / Add modal ─────────────────────────────── */}
      {modal.open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="flex flex-col"
            style={{
              width: 400,
              backgroundColor: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{
                borderBottom:    '1px solid var(--outline-variant)',
                backgroundColor: 'var(--surface-container-low)',
              }}
            >
              <span className="label-caps text-[var(--on-surface)]">
                {modal.existing ? 'EDIT_WORKOUT' : 'ADD_WORKOUT'}{' '}
                <span className="text-[var(--teal)]">{modal.date}</span>
              </span>
              <button
                onClick={closeModal}
                className="label-caps text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              >
                ✕
              </button>
            </div>

            {/* Modal fields */}
            <div className="flex flex-col gap-3 p-4">

              {/* workout_type */}
              <label className="flex flex-col gap-1">
                <span className="label-caps text-[var(--on-surface-variant)]">WORKOUT_TYPE</span>
                <select
                  value={form.workout_type}
                  onChange={e => setForm(f => ({ ...f, workout_type: e.target.value }))}
                  className="code-data px-2 py-1.5"
                  style={{
                    backgroundColor: 'var(--surface-container-high)',
                    color:           'var(--on-surface)',
                    border:          '1px solid var(--outline-variant)',
                    outline:         'none',
                  }}
                >
                  {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {/* target_distance_km */}
              <label className="flex flex-col gap-1">
                <span className="label-caps text-[var(--on-surface-variant)]">TARGET_DIST_KM</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.target_distance_km}
                  onChange={e => setForm(f => ({ ...f, target_distance_km: e.target.value }))}
                  placeholder="e.g. 10"
                  className="code-data text-[var(--teal)] bg-transparent px-2 py-1"
                  style={{ border: '1px solid var(--outline-variant)', outline: 'none', caretColor: 'var(--teal)' }}
                />
              </label>

              {/* target_metric_type */}
              <label className="flex flex-col gap-1">
                <span className="label-caps text-[var(--on-surface-variant)]">METRIC_TYPE</span>
                <select
                  value={form.target_metric_type}
                  onChange={e => setForm(f => ({ ...f, target_metric_type: e.target.value }))}
                  className="code-data px-2 py-1.5"
                  style={{
                    backgroundColor: 'var(--surface-container-high)',
                    color:           'var(--on-surface)',
                    border:          '1px solid var(--outline-variant)',
                    outline:         'none',
                  }}
                >
                  {METRIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {/* min / max */}
              <div className="flex gap-3">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="label-caps text-[var(--on-surface-variant)]">MIN</span>
                  <input
                    type="text"
                    value={form.target_metric_min}
                    onChange={e => setForm(f => ({ ...f, target_metric_min: e.target.value }))}
                    placeholder={form.target_metric_type === 'Pace' ? '5:30' : '136'}
                    className="code-data text-[var(--teal)] bg-transparent px-2 py-1"
                    style={{ border: '1px solid var(--outline-variant)', outline: 'none', caretColor: 'var(--teal)' }}
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="label-caps text-[var(--on-surface-variant)]">MAX</span>
                  <input
                    type="text"
                    value={form.target_metric_max}
                    onChange={e => setForm(f => ({ ...f, target_metric_max: e.target.value }))}
                    placeholder={form.target_metric_type === 'Pace' ? '5:45' : '145'}
                    className="code-data text-[var(--teal)] bg-transparent px-2 py-1"
                    style={{ border: '1px solid var(--outline-variant)', outline: 'none', caretColor: 'var(--teal)' }}
                  />
                </label>
              </div>

              {/* description */}
              <label className="flex flex-col gap-1">
                <span className="label-caps text-[var(--on-surface-variant)]">DESCRIPTION</span>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes"
                  className="code-data text-[var(--on-surface)] bg-transparent px-2 py-1"
                  style={{ border: '1px solid var(--outline-variant)', outline: 'none', caretColor: 'var(--teal)' }}
                />
              </label>

              {/* week phase */}
              <label className="flex flex-col gap-1">
                <span className="label-caps text-[var(--on-surface-variant)]">
                  WEEK_PHASE{' '}
                  <span style={{ opacity: 0.45 }}>W{modal.weekNum}</span>
                </span>
                <select
                  value={form.phase}
                  onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
                  className="code-data px-2 py-1.5"
                  style={{
                    backgroundColor: 'var(--surface-container-high)',
                    color:           'var(--on-surface)',
                    border:          '1px solid var(--outline-variant)',
                    outline:         'none',
                  }}
                >
                  {PHASE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>

              {saveError && (
                <span className="label-caps" style={{ color: 'var(--error)' }}>
                  ERR: {saveError}
                </span>
              )}
            </div>

            {/* Modal footer */}
            <div
              className="flex justify-end gap-3 px-4 py-3"
              style={{ borderTop: '1px solid var(--outline-variant)' }}
            >
              <button
                onClick={closeModal}
                className="label-caps px-4 py-2"
                style={{ border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="label-caps px-4 py-2"
                style={{
                  backgroundColor: saving ? 'var(--surface-container-high)' : 'var(--teal)',
                  color:           saving ? 'var(--on-surface-variant)' : '#000',
                  border:          '1px solid transparent',
                  cursor:          saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'SAVING…' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
