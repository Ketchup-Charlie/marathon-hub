"use client"

import { useState, useMemo } from "react"

/* ─── Types ──────────────────────────────────────────────── */

export type Shoe = {
  id: string
  brand: string
  model: string
  active_status: boolean
  max_lifespan_km: number | null
  current_mileage: number
}

type EditForm = {
  brand: string
  model: string
  max_lifespan_km: string
  current_mileage: string
  active_status: boolean
}

/* ─── Constants ──────────────────────────────────────────── */

const AUX_GEAR = [
  { name: "RACING_SOCKS",  detail: "QTY:4"     },
  { name: "ADRI_SINGLET",  detail: "QTY:1"     },
  { name: "HRM_STRAP",     detail: "STATUS:OK" },
]

const EMPTY_EDIT: EditForm = {
  brand: "", model: "", max_lifespan_km: "", current_mileage: "", active_status: true,
}

const EMPTY_ADD: EditForm = {
  brand: "", model: "", max_lifespan_km: "500", current_mileage: "", active_status: true,
}

/* ─── Helpers ────────────────────────────────────────────── */

function shoeStatus(shoe: Shoe): "ok" | "warn" | "crit" {
  if (!shoe.max_lifespan_km || shoe.max_lifespan_km === 0) return "ok"
  const pct = shoe.current_mileage / shoe.max_lifespan_km
  if (pct >= 0.95) return "crit"
  if (pct >= 0.80) return "warn"
  return "ok"
}

function statusColor(status: "ok" | "warn" | "crit"): string {
  if (status === "crit") return "#e05252"
  if (status === "warn") return "var(--amber)"
  return "var(--teal)"
}

function pct(shoe: Shoe): number {
  if (!shoe.max_lifespan_km || shoe.max_lifespan_km === 0) return 0
  return Math.min(1, shoe.current_mileage / shoe.max_lifespan_km)
}

function fmtKm(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function toTerminalName(brand: string, model: string): string {
  return `${brand.toUpperCase()}_${model.toUpperCase().replace(/\s+/g, "_")}`
}

function estDepletion(shoe: Shoe, recentDist: number): string {
  if (!shoe.max_lifespan_km) return "N/A"
  const remaining = shoe.max_lifespan_km - shoe.current_mileage
  if (remaining <= 0) return "OVERDUE"
  if (recentDist === 0) return "∞"
  const daily = recentDist / 30
  return `${Math.round(remaining / daily)} DAYS`
}

function shoeFromEdit(form: EditForm, userId?: string): Partial<Shoe> {
  return {
    brand:           form.brand.trim(),
    model:           form.model.trim(),
    max_lifespan_km: form.max_lifespan_km ? parseFloat(form.max_lifespan_km) : null,
    current_mileage: form.current_mileage  ? parseFloat(form.current_mileage)  : 0,
    active_status:   form.active_status,
  }
  void userId
}

/* ─── Shoe SVG icon ──────────────────────────────────────── */

function ShoeIcon({ color = "rgba(255,255,255,0.2)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 160 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 130, height: 65 }}>
      <path
        d="M14 55 Q22 63 52 63 L132 60 Q147 57 149 51 Q151 44 141 42 L90 37 Q68 34 55 37 Q40 41 28 40 Q18 40 15 47 Q11 51 14 55Z"
        fill="rgba(255,255,255,0.05)"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M55 37 Q58 25 72 20 Q82 16 88 23 Q92 28 91 35 L90 37 Q72 37 55 37Z"
        fill="rgba(255,255,255,0.03)"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="62" y1="27" x2="83" y2="23" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      <line x1="60" y1="32" x2="86" y2="28" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      <path d="M25 40 Q17 43 15 49" stroke={color} strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Status label ───────────────────────────────────────── */

function StatusLabel({ status }: { status: "ok" | "warn" | "crit" }) {
  const color = statusColor(status)
  const label = status === "crit" ? "CRITICAL" : status === "warn" ? "WARNING" : "NOMINAL"
  return (
    <div className="flex items-center gap-1.5">
      <span className="label-caps" style={{ fontSize: 9, color }}>{label}</span>
      <span className="inline-block flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: color }} />
    </div>
  )
}

/* ─── Field row (compact input inside card) ──────────────── */

function FieldRow({
  label, value, onChange, type = "text", disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps text-[var(--on-surface-variant)] flex-shrink-0" style={{ fontSize: 9, minWidth: 96 }}>
        {label}:
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="code-data text-[var(--on-surface)] bg-transparent outline-none flex-1 min-w-0"
        style={{
          borderBottom: "1px solid var(--outline-variant)",
          caretColor:   "var(--teal)",
          fontSize:     12,
        }}
        step={type === "number" ? "0.1" : undefined}
        min={type === "number" ? "0" : undefined}
      />
    </div>
  )
}

/* ─── Toggle (ACTIVE / INACTIVE) ────────────────────────── */

function ActiveToggle({
  value, onChange,
}: {
  value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>STATUS:</span>
      <button
        onClick={() => onChange(true)}
        className="label-caps"
        style={{
          fontSize: 9, padding: "2px 8px",
          border: `1px solid ${value ? "var(--teal)" : "var(--outline-variant)"}`,
          color:  value ? "var(--teal)" : "var(--on-surface-variant)",
          backgroundColor: value ? "rgba(45,219,222,0.07)" : "transparent",
        }}
      >
        ACTIVE
      </button>
      <button
        onClick={() => onChange(false)}
        className="label-caps"
        style={{
          fontSize: 9, padding: "2px 8px",
          border: `1px solid ${!value ? "var(--outline-variant)" : "var(--outline-variant)"}`,
          color:  !value ? "var(--amber)" : "var(--on-surface-variant)",
          backgroundColor: !value ? "rgba(255,179,0,0.07)" : "transparent",
        }}
      >
        INACTIVE
      </button>
    </div>
  )
}

/* ─── Shoe card ──────────────────────────────────────────── */

function ShoeCard({
  shoe,
  tags,
  expanded,
  onExpand,
  editForm,
  onFormChange,
  onSave,
  onDelete,
  saving,
  deleting,
  error,
}: {
  shoe: Shoe
  tags: string[]
  expanded: boolean
  onExpand: () => void
  editForm: EditForm
  onFormChange: (f: EditForm) => void
  onSave: () => void
  onDelete: () => void
  saving: boolean
  deleting: boolean
  error: string | null
}) {
  const st     = shoeStatus(shoe)
  const sColor = statusColor(st)
  const milePct = pct(shoe)

  return (
    <div
      style={{
        border:          "1px solid var(--outline-variant)",
        backgroundColor: "var(--surface-container-low)",
        display:         "flex",
        flexDirection:   "column",
        opacity:         shoe.active_status ? 1 : 0.5,
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{
          borderBottom:    "1px solid var(--outline-variant)",
          backgroundColor: "var(--surface-container)",
          cursor:          expanded ? "default" : "pointer",
        }}
        onClick={expanded ? undefined : onExpand}
      >
        <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 10, letterSpacing: "0.06em" }}>
          {toTerminalName(shoe.brand, shoe.model)}
        </span>
        <StatusLabel status={st} />
      </div>

      {expanded ? (
        /* ── Edit mode ─────────────────────────────── */
        <div className="flex flex-col gap-2.5 p-3">
          <FieldRow label="BRAND"     value={editForm.brand}           onChange={(v) => onFormChange({ ...editForm, brand: v })}           disabled={saving} />
          <FieldRow label="MODEL"     value={editForm.model}           onChange={(v) => onFormChange({ ...editForm, model: v })}           disabled={saving} />
          <FieldRow label="MAX_KM"    value={editForm.max_lifespan_km} onChange={(v) => onFormChange({ ...editForm, max_lifespan_km: v })} disabled={saving} type="number" />
          <FieldRow label="CURR_KM"   value={editForm.current_mileage} onChange={(v) => onFormChange({ ...editForm, current_mileage: v })} disabled={saving} type="number" />
          <ActiveToggle value={editForm.active_status} onChange={(v) => onFormChange({ ...editForm, active_status: v })} />

          {error && (
            <span className="label-caps" style={{ fontSize: 9, color: "#e05252" }}>ERR: {error}</span>
          )}

          <div className="flex items-center justify-between mt-1">
            <button
              onClick={onDelete}
              disabled={deleting || saving}
              className="label-caps transition-colors"
              style={{
                fontSize: 9, padding: "2px 8px",
                border:  "1px solid var(--outline-variant)",
                color:   deleting ? "var(--on-surface-variant)" : "#e05252",
                cursor:  deleting || saving ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "DELETING…" : "DELETE"}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onExpand}
                disabled={saving}
                className="label-caps"
                style={{
                  fontSize: 9, padding: "2px 8px",
                  border: "1px solid var(--outline-variant)",
                  color:  "var(--on-surface-variant)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="label-caps"
                style={{
                  fontSize: 9, padding: "2px 8px",
                  backgroundColor: saving ? "var(--surface-container-high)" : "var(--teal)",
                  color:           saving ? "var(--on-surface-variant)" : "#000",
                  cursor:          saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── View mode ─────────────────────────────── */
        <div
          onClick={onExpand}
          style={{ cursor: "pointer", flex: 1 }}
        >
          {/* Shoe image area */}
          <div
            className="flex items-center justify-center"
            style={{
              height:          96,
              backgroundColor: "var(--surface-container-lowest)",
              borderBottom:    "1px solid var(--outline-variant)",
            }}
          >
            <ShoeIcon color={sColor} />
          </div>

          {/* Mileage + info */}
          <div className="px-3 pt-2.5 pb-3">
            <div className="flex items-baseline gap-1.5">
              <span
                style={{
                  fontSize:      34,
                  fontWeight:    700,
                  color:         "var(--on-surface)",
                  letterSpacing: "-0.02em",
                  lineHeight:    1,
                  fontFamily:    "var(--font-space-grotesk)",
                }}
              >
                {Math.round(shoe.current_mileage)}
              </span>
              {shoe.max_lifespan_km && (
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 10 }}>
                  /{fmtKm(shoe.max_lifespan_km)}km
                </span>
              )}
              {!shoe.max_lifespan_km && (
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 10 }}>km</span>
              )}
            </div>

            {/* Progress bar */}
            {shoe.max_lifespan_km != null && shoe.max_lifespan_km > 0 && (
              <div
                style={{ height: 3, backgroundColor: "var(--surface-container-high)", marginTop: 6 }}
              >
                <div
                  style={{
                    height:          "100%",
                    width:           `${Math.min(100, milePct * 100).toFixed(1)}%`,
                    backgroundColor: sColor,
                    transition:      "width 0.3s ease",
                  }}
                />
              </div>
            )}

            {/* Run type tags */}
            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="label-caps"
                    style={{
                      fontSize:         8,
                      padding:          "1px 5px",
                      border:           "1px solid var(--outline-variant)",
                      color:            "var(--on-surface-variant)",
                      letterSpacing:    "0.06em",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Add modal ──────────────────────────────────────────── */

function AddModal({
  form,
  onChange,
  onSave,
  onClose,
  saving,
  error,
}: {
  form: EditForm
  onChange: (f: EditForm) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col"
        style={{
          width:           380,
          backgroundColor: "var(--surface-container)",
          border:          "1px solid var(--outline-variant)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            borderBottom:    "1px solid var(--outline-variant)",
            backgroundColor: "var(--surface-container-low)",
          }}
        >
          <span className="label-caps text-[var(--on-surface)]">ADD_ITEM</span>
          <button onClick={onClose} className="label-caps text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">✕</button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1">
            <span className="label-caps text-[var(--on-surface-variant)]">BRAND</span>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => onChange({ ...form, brand: e.target.value })}
              placeholder="e.g. Nike"
              className="code-data text-[var(--on-surface)] bg-transparent px-2 py-1 outline-none"
              style={{ border: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label-caps text-[var(--on-surface-variant)]">MODEL</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => onChange({ ...form, model: e.target.value })}
              placeholder="e.g. Vaporfly 3"
              className="code-data text-[var(--on-surface)] bg-transparent px-2 py-1 outline-none"
              style={{ border: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label-caps text-[var(--on-surface-variant)]">MAX_LIFESPAN_KM</span>
            <input
              type="number"
              min="0"
              step="50"
              value={form.max_lifespan_km}
              onChange={(e) => onChange({ ...form, max_lifespan_km: e.target.value })}
              placeholder="500"
              className="code-data text-[var(--teal)] bg-transparent px-2 py-1 outline-none"
              style={{ border: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label-caps text-[var(--on-surface-variant)]">CURRENT_MILEAGE_KM</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.current_mileage}
              onChange={(e) => onChange({ ...form, current_mileage: e.target.value })}
              placeholder="0"
              className="code-data text-[var(--teal)] bg-transparent px-2 py-1 outline-none"
              style={{ border: "1px solid var(--outline-variant)", caretColor: "var(--teal)" }}
            />
            <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9, opacity: 0.6 }}>
              Enter existing mileage if not a new shoe, or 0 for new
            </span>
          </label>

          <ActiveToggle value={form.active_status} onChange={(v) => onChange({ ...form, active_status: v })} />

          {error && (
            <span className="label-caps" style={{ color: "#e05252", fontSize: 10 }}>ERR: {error}</span>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-4 py-3"
          style={{ borderTop: "1px solid var(--outline-variant)" }}
        >
          <button
            onClick={onClose}
            className="label-caps px-4 py-2"
            style={{ border: "1px solid var(--outline-variant)", color: "var(--on-surface-variant)" }}
          >
            CANCEL
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="label-caps px-4 py-2"
            style={{
              backgroundColor: saving ? "var(--surface-container-high)" : "var(--teal)",
              color:           saving ? "var(--on-surface-variant)" : "#000",
              cursor:          saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "SAVING…" : "CONFIRM"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function GearLabClient({
  shoes: initialShoes,
  runTagsByShoe,
  recentDistByShoe,
}: {
  shoes: Shoe[]
  runTagsByShoe: Record<string, string[]>
  recentDistByShoe: Record<string, number>
}) {
  const [shoes, setShoes]           = useState<Shoe[]>(initialShoes)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<EditForm>(EMPTY_EDIT)
  const [savingId, setSavingId]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cardError, setCardError]   = useState<string | null>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState<EditForm>(EMPTY_ADD)
  const [addSaving, setAddSaving]   = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)

  /* ── Derived ────────────────────────────────────────────── */

  const activeShoes   = useMemo(() => shoes.filter((s) => s.active_status),  [shoes])
  const inactiveShoes = useMemo(() => shoes.filter((s) => !s.active_status), [shoes])

  const burnRateWeekly = useMemo(() => {
    const totalKm = activeShoes.reduce((s, sh) => s + (recentDistByShoe[sh.id] ?? 0), 0)
    return (totalKm / 30) * 7
  }, [activeShoes, recentDistByShoe])

  const forecastShoes = useMemo(
    () => shoes.filter((s) => s.max_lifespan_km != null),
    [shoes]
  )

  /* ── Card expand / collapse ─────────────────────────────── */

  function handleExpand(shoe: Shoe) {
    if (expandedId === shoe.id) {
      setExpandedId(null)
      setCardError(null)
      return
    }
    setExpandedId(shoe.id)
    setCardError(null)
    setEditForm({
      brand:           shoe.brand,
      model:           shoe.model,
      max_lifespan_km: shoe.max_lifespan_km != null ? String(shoe.max_lifespan_km) : "",
      current_mileage: String(shoe.current_mileage),
      active_status:   shoe.active_status,
    })
  }

  /* ── Save edited shoe ───────────────────────────────────── */

  async function handleSave(id: string) {
    setSavingId(id)
    setCardError(null)
    try {
      const updates = shoeFromEdit(editForm)
      const res  = await fetch(`/api/shoes/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      })
      const data = await res.json() as Shoe & { error?: string }
      if (!res.ok) {
        setCardError(data.error ?? "SAVE_FAILED")
        return
      }
      setShoes((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
      setExpandedId(null)
    } catch {
      setCardError("NETWORK_ERROR")
    } finally {
      setSavingId(null)
    }
  }

  /* ── Delete shoe ────────────────────────────────────────── */

  async function handleDelete(id: string) {
    setDeletingId(id)
    setCardError(null)
    try {
      const res = await fetch(`/api/shoes/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        const d = await res.json() as { error?: string }
        setCardError(d.error ?? "DELETE_FAILED")
        return
      }
      setShoes((prev) => prev.filter((s) => s.id !== id))
      setExpandedId(null)
    } catch {
      setCardError("NETWORK_ERROR")
    } finally {
      setDeletingId(null)
    }
  }

  /* ── Add shoe ───────────────────────────────────────────── */

  async function handleAdd() {
    if (!addForm.brand.trim() || !addForm.model.trim()) {
      setAddError("BRAND_AND_MODEL_REQUIRED")
      return
    }
    setAddSaving(true)
    setAddError(null)
    try {
      const res  = await fetch("/api/shoes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          brand:           addForm.brand.trim(),
          model:           addForm.model.trim(),
          max_lifespan_km: addForm.max_lifespan_km ? parseFloat(addForm.max_lifespan_km) : null,
          current_mileage: addForm.current_mileage  ? parseFloat(addForm.current_mileage)  : 0,
          active_status:   addForm.active_status,
        }),
      })
      const data = await res.json() as Shoe & { error?: string }
      if (!res.ok) {
        setAddError(data.error ?? "ADD_FAILED")
        return
      }
      setShoes((prev) => [data, ...prev])
      setShowAdd(false)
      setAddForm(EMPTY_ADD)
    } catch {
      setAddError("NETWORK_ERROR")
    } finally {
      setAddSaving(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height:          36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom:    "1px solid var(--outline-variant)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--teal)]">GEAR_LAB</span>
          <span className="label-caps text-[var(--on-surface-variant)]">:: STATUS_MONITORING</span>
          <span className="label-caps text-[var(--on-surface-variant)]">
            {activeShoes.length} PRIMARY_ASSETS
          </span>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddForm(EMPTY_ADD); setAddError(null) }}
          className="label-caps px-3 py-1 transition-colors hover:bg-[var(--teal)] hover:text-[var(--on-teal)]"
          style={{
            border: "1px solid var(--teal)",
            color:  "var(--teal)",
          }}
        >
          + ADD_ITEM
        </button>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: ACTIVE_HARDWARE ──────────────────────── */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: "0 0 63%", borderRight: "1px solid var(--outline-variant)" }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{
              borderBottom:    "1px solid var(--outline-variant)",
              backgroundColor: "var(--surface-container-low)",
            }}
          >
            <span className="label-caps text-[var(--on-surface)]">ACTIVE_HARDWARE</span>
            <span className="label-caps text-[var(--on-surface-variant)]">{shoes.length} ASSETS</span>
          </div>

          {shoes.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.4 }}>
                NO_ASSETS — click + ADD_ITEM to register a shoe
              </span>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-6">

              {/* Active shoes */}
              {activeShoes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>
                      ROTATION_PRIMARY
                    </span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "var(--outline-variant)" }} />
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {activeShoes.map((shoe) => (
                      <ShoeCard
                        key={shoe.id}
                        shoe={shoe}
                        tags={runTagsByShoe[shoe.id] ?? []}
                        expanded={expandedId === shoe.id}
                        onExpand={() => handleExpand(shoe)}
                        editForm={editForm}
                        onFormChange={setEditForm}
                        onSave={() => void handleSave(shoe.id)}
                        onDelete={() => void handleDelete(shoe.id)}
                        saving={savingId === shoe.id}
                        deleting={deletingId === shoe.id}
                        error={expandedId === shoe.id ? cardError : null}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inactive shoes */}
              {inactiveShoes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>
                      RETIRED
                    </span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "var(--outline-variant)" }} />
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {inactiveShoes.map((shoe) => (
                      <ShoeCard
                        key={shoe.id}
                        shoe={shoe}
                        tags={runTagsByShoe[shoe.id] ?? []}
                        expanded={expandedId === shoe.id}
                        onExpand={() => handleExpand(shoe)}
                        editForm={editForm}
                        onFormChange={setEditForm}
                        onSave={() => void handleSave(shoe.id)}
                        onDelete={() => void handleDelete(shoe.id)}
                        saving={savingId === shoe.id}
                        deleting={deletingId === shoe.id}
                        error={expandedId === shoe.id ? cardError : null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: FORECAST + AUX ──────────────────────── */}
        <div className="flex flex-col flex-1 overflow-y-auto">

          {/* WEAR_FORECAST_MODEL */}
          <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{
                borderBottom:    "1px solid var(--outline-variant)",
                backgroundColor: "var(--surface-container-low)",
              }}
            >
              <span className="label-caps text-[var(--on-surface)]">WEAR_FORECAST_MODEL</span>
            </div>

            {/* Forecast table */}
            {forecastShoes.length === 0 ? (
              <div className="px-4 py-4">
                <span className="code-data text-[var(--on-surface-variant)]" style={{ fontSize: 11, opacity: 0.5 }}>
                  Set max_lifespan_km on a shoe to see forecast
                </span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  className="grid px-4 py-1.5"
                  style={{
                    gridTemplateColumns:  "1fr 100px",
                    borderBottom:         "1px solid var(--outline-variant)",
                    backgroundColor:      "var(--surface-container-low)",
                  }}
                >
                  <span className="label-caps text-[var(--on-surface-variant)]">ASSET</span>
                  <span className="label-caps text-[var(--on-surface-variant)]">EST_DEPLETION</span>
                </div>

                {forecastShoes.map((shoe) => {
                  const recentKm = recentDistByShoe[shoe.id] ?? 0
                  const depletion = estDepletion(shoe, recentKm)
                  const st = shoeStatus(shoe)
                  return (
                    <div
                      key={shoe.id}
                      className="grid px-4 py-2"
                      style={{
                        gridTemplateColumns: "1fr 100px",
                        borderBottom:        "1px solid var(--outline-variant)",
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 10 }}>
                          {toTerminalName(shoe.brand, shoe.model)}
                        </span>
                        {recentKm > 0 && (
                          <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9, opacity: 0.6 }}>
                            {fmtKm(recentKm)}km / 30D
                          </span>
                        )}
                      </div>
                      <span
                        className="code-data"
                        style={{
                          fontSize:  12,
                          color:     depletion === "OVERDUE" ? "#e05252"
                                     : depletion === "∞"     ? "var(--on-surface-variant)"
                                     : statusColor(st),
                        }}
                      >
                        {depletion}
                      </span>
                    </div>
                  )
                })}
              </>
            )}

            {/* Burn rate stat */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ backgroundColor: "var(--surface-container-low)" }}
            >
              <span className="label-caps text-[var(--on-surface-variant)]">CURRENT_BURN_RATE</span>
              <div className="flex items-baseline gap-1">
                <span
                  style={{
                    fontSize:   20,
                    fontWeight: 700,
                    color:      "var(--teal)",
                    fontFamily: "var(--font-space-grotesk)",
                    lineHeight: 1,
                  }}
                >
                  {burnRateWeekly > 0 ? fmtKm(burnRateWeekly) : "0"}
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 9 }}>km/wk</span>
              </div>
            </div>
          </div>

          {/* AUXILIARY_GEAR_INVENTORY */}
          <div>
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{
                borderBottom:    "1px solid var(--outline-variant)",
                backgroundColor: "var(--surface-container-low)",
              }}
            >
              <span className="label-caps text-[var(--on-surface)]">AUXILIARY_GEAR_INVENTORY</span>
              <span className="label-caps text-[var(--on-surface-variant)]">{AUX_GEAR.length} ITEMS</span>
            </div>

            {AUX_GEAR.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--outline-variant)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block flex-shrink-0"
                    style={{ width: 8, height: 8, backgroundColor: "var(--teal)" }}
                  />
                  <span className="label-caps text-[var(--on-surface)]" style={{ fontSize: 11 }}>
                    {item.name}
                  </span>
                </div>
                <span className="label-caps text-[var(--on-surface-variant)]" style={{ fontSize: 10 }}>
                  {item.detail}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddModal
          form={addForm}
          onChange={setAddForm}
          onSave={() => void handleAdd()}
          onClose={() => setShowAdd(false)}
          saving={addSaving}
          error={addError}
        />
      )}
    </div>
  )
}
