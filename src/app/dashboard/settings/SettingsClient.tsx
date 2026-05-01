"use client"

import React, { useState, useRef } from "react"
import { calcPaces } from "@/lib/pace"

type RaceConfig = {
  race_name: string | null
  race_date: string | null
  target_time: string
  pace_mp: string | null
  pace_tempo: string | null
  pace_interval: string | null
  pace_easy: string | null
} | null

type Block = { id: string; total_weeks: number } | null

function initForm(config: RaceConfig, block: Block) {
  const targetTime = config?.target_time ?? "4:15:00"
  const hasSavedPaces = !!config?.pace_mp
  const paces = hasSavedPaces
    ? { mp: config!.pace_mp!, tempo: config!.pace_tempo ?? "", int: config!.pace_interval ?? "", easy: config!.pace_easy ?? "" }
    : (calcPaces(targetTime) ?? { mp: "", tempo: "", int: "", easy: "" })
  return {
    race_name:     config?.race_name  ?? "",
    race_date:     config?.race_date  ?? "",
    target_time:   targetTime,
    pace_mp:       paces.mp,
    pace_tempo:    paces.tempo,
    pace_interval: paces.int,
    pace_easy:     paces.easy,
    total_weeks:   block?.total_weeks ?? 12,
  }
}

export default function SettingsClient({
  raceConfig,
  block,
}: {
  raceConfig: RaceConfig
  block: Block
}) {
  const [form, setForm]                     = useState(() => initForm(raceConfig, block))
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [confirmingWeeks, setConfirmingWeeks] = useState(false)
  const originalWeeks                       = useRef(block?.total_weeks ?? null)

  function recalculate(targetTime: string) {
    const p = calcPaces(targetTime)
    if (!p) return
    setForm(f => ({ ...f, pace_mp: p.mp, pace_tempo: p.tempo, pace_interval: p.int, pace_easy: p.easy }))
  }

  function handleSaveClick() {
    const weeksChanged = block !== null && form.total_weeks !== originalWeeks.current
    if (weeksChanged) {
      setConfirmingWeeks(true)
    } else {
      void doSave()
    }
  }

  async function doSave() {
    setConfirmingWeeks(false)
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const body: Record<string, unknown> = {
        race_name:     form.race_name     || null,
        race_date:     form.race_date     || null,
        target_time:   form.target_time,
        pace_mp:       form.pace_mp       || null,
        pace_tempo:    form.pace_tempo     || null,
        pace_interval: form.pace_interval  || null,
        pace_easy:     form.pace_easy      || null,
      }
      if (block !== null) body.total_weeks = form.total_weeks

      const rcRes = await fetch("/api/race-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!rcRes.ok) {
        const d = await rcRes.json()
        setError(d.error ?? "SAVE_FAILED")
        return
      }
      originalWeeks.current = form.total_weeks

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("NETWORK_ERROR")
    } finally {
      setSaving(false)
    }
  }

  const PACE_FIELDS = [
    { key: "pace_mp",       label: "MP",       color: "var(--on-surface)"  },
    { key: "pace_tempo",    label: "TEMPO",    color: "var(--on-surface)"  },
    { key: "pace_interval", label: "INTERVAL", color: "var(--amber)"       },
    { key: "pace_easy",     label: "EASY",     color: "var(--on-surface)"  },
  ] as const

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>
      {/* Status bar */}
      <div
        className="flex items-center px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <span className="label-caps text-[var(--teal)]">SETTINGS</span>
        <span className="label-caps text-[var(--on-surface-variant)] ml-2">:: RACE_CONFIG</span>
      </div>

      <div className="flex flex-col overflow-auto flex-1">
        {/* ── RACE_CONFIG ──────────────────────────────────── */}
        <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
          <div
            className="flex items-center px-4 py-2"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface)]">RACE_CONFIG</span>
          </div>

          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: "160px 1fr",
              backgroundColor: "var(--outline-variant)",
            }}
          >
            {/* Text fields */}
            {[
              { key: "race_name",   label: "RACE_NAME",   placeholder: "Sydney Marathon 2026", teal: false },
              { key: "race_date",   label: "RACE_DATE",   placeholder: "YYYY-MM-DD",           teal: false },
              { key: "target_time", label: "TARGET_TIME", placeholder: "h:mm:ss",              teal: true  },
            ].map(({ key, label, placeholder, teal }) => (
              <React.Fragment key={key}>
                <div
                  className="flex items-center px-4 py-2.5 label-caps text-[var(--on-surface-variant)]"
                  style={{ backgroundColor: "var(--surface-container-low)" }}
                >
                  {label}
                </div>
                <div
                  className="flex items-center px-4 py-2"
                  style={{ backgroundColor: "var(--surface)" }}
                >
                  <input
                    type="text"
                    value={form[key as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    onBlur={key === "target_time" ? () => recalculate(form.target_time) : undefined}
                    className={`code-data bg-transparent outline-none w-full ${teal ? "text-[var(--teal)]" : "text-[var(--on-surface)]"}`}
                    style={{ borderBottom: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
                    placeholder={placeholder}
                    spellCheck={false}
                  />
                </div>
              </React.Fragment>
            ))}

            {/* TRAINING_WEEKS */}
            <div
              className="flex items-start px-4 py-2.5 label-caps text-[var(--on-surface-variant)]"
              style={{ backgroundColor: "var(--surface-container-low)" }}
            >
              TRAINING_WEEKS
            </div>
            <div
              className="flex flex-col px-4 py-2"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <input
                type="number"
                min={6}
                max={24}
                value={form.total_weeks}
                onChange={e => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) setForm(f => ({ ...f, total_weeks: v }))
                }}
                onBlur={() =>
                  setForm(f => ({
                    ...f,
                    total_weeks: Math.min(24, Math.max(6, f.total_weeks || 12)),
                  }))
                }
                className="code-data text-[var(--teal)] bg-transparent outline-none w-20"
                style={{ borderBottom: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
              />
              <span
                className="label-caps text-[var(--on-surface-variant)] mt-1"
                style={{ fontSize: 9 }}
              >
                FINAL WEEK IS ALWAYS RACE_WEEK
              </span>
            </div>
          </div>
        </div>

        {/* ── PACE_TARGETS ─────────────────────────────────── */}
        <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              borderBottom: "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface)]">PACE_TARGETS</span>
            <button
              onClick={() => recalculate(form.target_time)}
              className="label-caps px-3 py-1 text-[var(--on-surface-variant)] hover:text-[var(--teal)] transition-colors"
              style={{ border: "1px solid var(--outline-variant)" }}
            >
              RECALCULATE
            </button>
          </div>

          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: "160px 1fr",
              backgroundColor: "var(--outline-variant)",
            }}
          >
            {PACE_FIELDS.map(({ key, label, color }) => (
              <React.Fragment key={key}>
                <div
                  className="flex items-center px-4 py-2.5 label-caps text-[var(--on-surface-variant)]"
                  style={{ backgroundColor: "var(--surface-container-low)" }}
                >
                  {label}
                </div>
                <div
                  className="flex items-center px-4 py-2"
                  style={{ backgroundColor: "var(--surface)" }}
                >
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="code-data bg-transparent outline-none w-full"
                    style={{ borderBottom: "1px solid var(--outline-variant)", caretColor: "var(--teal)", color }}
                    placeholder="M:SS"
                    spellCheck={false}
                  />
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Weeks-change confirmation warning ────────────── */}
        {confirmingWeeks && (
          <div
            className="flex flex-col gap-2 px-4 py-3 flex-shrink-0"
            style={{
              backgroundColor: "var(--surface-container-low)",
              borderBottom: "1px solid var(--outline-variant)",
            }}
          >
            <span className="label-caps" style={{ color: "var(--amber)" }}>
              WARNING: TRAINING_WEEKS {block!.total_weeks} → {form.total_weeks}. BLOCK START_DATE AND RACE_WEEK WILL SHIFT.
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => void doSave()}
                className="label-caps px-3 py-1.5"
                style={{ backgroundColor: "var(--amber)", color: "#000" }}
              >
                CONFIRM_SAVE
              </button>
              <button
                onClick={() => setConfirmingWeeks(false)}
                className="label-caps px-3 py-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
                style={{ border: "1px solid var(--outline-variant)" }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* ── Save row ─────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={handleSaveClick}
            disabled={saving || confirmingWeeks}
            className="label-caps px-4 py-2"
            style={{ backgroundColor: "var(--teal)", color: "var(--on-teal)" }}
          >
            {saving ? "SAVING..." : "SAVE_CONFIG"}
          </button>
          {saved && (
            <span className="label-caps text-[var(--teal)]">CONFIG_SAVED</span>
          )}
          {error && (
            <span className="label-caps" style={{ color: "var(--amber)" }}>
              ERR: {error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
