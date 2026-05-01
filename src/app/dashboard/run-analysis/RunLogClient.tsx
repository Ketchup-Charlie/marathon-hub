"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"

/* ─── Types ─────────────────────────────────────────────── */

export type Run = {
  id: string
  date: string
  title: string | null
  run_type_tag: string | null
  total_distance: number | null
  total_time: string | null
  avg_pace: string | null
  avg_hr: number | null
  avg_gct: number | null
  avg_cadence: number | null
  compliance_score: string | null
}

/* ─── Constants ──────────────────────────────────────────── */

const PAGE_SIZE = 20
const COLS = "80px 1fr 90px 75px 75px 80px 70px 80px 85px 60px 110px"

/* ─── Helpers ────────────────────────────────────────────── */

function fmtDist(km: number | null): string {
  if (km == null) return "--"
  return `${km.toFixed(2)} km`
}

function fmtGct(ms: number | null): string {
  if (ms == null) return "--"
  return `${Math.round(ms)} ms`
}

/* ─── Compliance dot ─────────────────────────────────────── */

function ComplianceDot({ score }: { score: string | null }) {
  if (!score) return <span className="code-data text-[var(--on-surface-variant)]">--</span>
  const bg =
    score === "Green"  ? "var(--teal)"
    : score === "Yellow" ? "var(--amber)"
    : "#e05252"
  return (
    <span
      className="inline-block"
      style={{ width: 8, height: 8, backgroundColor: bg, flexShrink: 0 }}
    />
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function RunLogClient({ runs: initialRuns }: { runs: Run[] }) {
  const router = useRouter()

  const [runs, setRuns]             = useState<Run[]>(initialRuns)
  const [filterType, setFilterType] = useState("All")
  const [fromDate, setFromDate]     = useState("")
  const [toDate, setToDate]         = useState("")
  const [page, setPage]             = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  /* reset page on filter change */
  useEffect(() => { setPage(0) }, [filterType, fromDate, toDate])

  /* ── Derived ────────────────────────────────────────────── */

  const typeOptions = useMemo(() => {
    const types = Array.from(
      new Set(runs.map((r) => r.run_type_tag).filter((t): t is string => t !== null))
    ).sort()
    return ["All", ...types]
  }, [runs])

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (filterType !== "All" && r.run_type_tag !== filterType) return false
      if (fromDate && r.date < fromDate) return false
      if (toDate   && r.date > toDate)   return false
      return true
    })
  }, [runs, filterType, fromDate, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const hasFilters = filterType !== "All" || !!fromDate || !!toDate

  function clearFilters() {
    setFilterType("All")
    setFromDate("")
    setToDate("")
  }

  /* ── Delete ─────────────────────────────────────────────── */

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/runs/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setDeleteError(d.error ?? "DELETE_FAILED")
        setDeletingId(null)
        setTimeout(() => setDeleteError(null), 4000)
        return
      }
      setRuns((prev) => prev.filter((r) => r.id !== id))
      setDeletingId(null)
    } catch {
      setDeleteError("NETWORK_ERROR")
      setDeletingId(null)
      setTimeout(() => setDeleteError(null), 4000)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)", minWidth: 960 }}>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: "var(--surface-container-low)",
          borderBottom: "1px solid var(--outline-variant)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--teal)]">RUN_LOG</span>
          <span className="label-caps text-[var(--on-surface-variant)]">:: ALL_SESSIONS</span>
        </div>
        <span className="label-caps text-[var(--on-surface-variant)]">
          {runs.length} SESSIONS
        </span>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-6 px-4 py-2 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--outline-variant)",
          backgroundColor: "var(--surface-container-low)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">TYPE:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "none",
              borderBottom: "1px solid var(--outline-variant)",
              caretColor: "var(--teal)",
              minWidth: 100,
            }}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">FROM:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 0,
              colorScheme: "dark",
              caretColor: "var(--teal)",
              padding: "2px 6px",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[var(--on-surface-variant)]">TO:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="code-data text-[var(--on-surface)] outline-none"
            style={{
              backgroundColor: "var(--surface-container-low)",
              border: "1px solid var(--outline-variant)",
              borderRadius: 0,
              colorScheme: "dark",
              caretColor: "var(--teal)",
              padding: "2px 6px",
            }}
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="label-caps text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            style={{ border: "1px solid var(--outline-variant)", padding: "2px 10px" }}
          >
            CLEAR
          </button>
        )}

        <span className="ml-auto label-caps text-[var(--on-surface-variant)]">
          {filtered.length !== runs.length ? `${filtered.length} / ${runs.length} SESSIONS` : ""}
        </span>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div
          className="px-4 py-2 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(224,82,82,0.4)",
            backgroundColor: "rgba(224,82,82,0.08)",
          }}
        >
          <span className="label-caps" style={{ color: "#e05252" }}>ERR: {deleteError}</span>
        </div>
      )}

      {/* Table header */}
      <div
        className="grid flex-shrink-0 px-4 py-1.5"
        style={{
          gridTemplateColumns: COLS,
          borderBottom: "1px solid var(--outline-variant)",
          backgroundColor: "var(--surface-container-low)",
        }}
      >
        {["DATE", "TITLE", "TYPE", "DISTANCE", "TIME", "AVG_PACE", "AVG_HR", "GCT", "CADENCE", "COMPLY", "ACTIONS"].map(
          (col) => (
            <span key={col} className="label-caps text-[var(--on-surface-variant)]">
              {col}
            </span>
          )
        )}
      </div>

      {/* Table rows */}
      <div className="flex flex-col overflow-y-auto flex-1">
        {paged.length === 0 ? (
          <div className="px-4 py-6">
            <span className="code-data text-[var(--on-surface-variant)]">
              {runs.length === 0 ? "NO_SESSIONS — upload a run to get started" : "NO_RESULTS — adjust filters"}
            </span>
          </div>
        ) : (
          paged.map((row) => (
            <div
              key={row.id}
              className="grid items-center px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-container)]"
              onClick={() => router.push(`/dashboard/run-analysis/${row.id}`)}
              style={{
                gridTemplateColumns: COLS,
                borderBottom: "1px solid var(--outline-variant)",
              }}
            >
              <span className="code-data text-[var(--on-surface-variant)]">{row.date}</span>

              <span
                className="code-data text-[var(--on-surface)] truncate pr-2"
                title={row.title ?? ""}
              >
                {row.title ?? "--"}
              </span>

              <span className="code-data text-[var(--on-surface-variant)]">
                {row.run_type_tag ?? "--"}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {fmtDist(row.total_distance)}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {row.total_time ?? "--"}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {row.avg_pace ?? "--"}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {row.avg_hr != null ? `${Math.round(row.avg_hr)}` : "--"}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {fmtGct(row.avg_gct)}
              </span>

              <span className="code-data text-[var(--on-surface)]">
                {row.avg_cadence != null ? `${row.avg_cadence}` : "--"}
              </span>

              <div className="flex items-center">
                <ComplianceDot score={row.compliance_score} />
              </div>

              {/* ACTIONS — stop propagation so clicks don't navigate */}
              <div
                className="flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {deletingId === row.id ? (
                  <div className="flex items-center gap-1">
                    <span
                      className="label-caps"
                      style={{ color: "var(--amber)", fontSize: 10 }}
                    >
                      DEL?
                    </span>
                    <button
                      onClick={() => void handleDelete(row.id)}
                      disabled={deleting}
                      className="label-caps"
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        backgroundColor: deleting ? "var(--surface-container-high)" : "#e05252",
                        color: deleting ? "var(--on-surface-variant)" : "#fff",
                        cursor: deleting ? "not-allowed" : "pointer",
                      }}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      disabled={deleting}
                      className="label-caps"
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        border: "1px solid var(--outline-variant)",
                        color: "var(--on-surface-variant)",
                      }}
                    >
                      NO
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(row.id)}
                    className="label-caps hover:text-[#e05252] transition-colors"
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      border: "1px solid var(--outline-variant)",
                      color: "var(--on-surface-variant)",
                    }}
                  >
                    DELETE
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          borderTop: "1px solid var(--outline-variant)",
          backgroundColor: "var(--surface-container-low)",
        }}
      >
        <span className="label-caps text-[var(--on-surface-variant)]">
          PAGE {page + 1} OF {totalPages}
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="label-caps px-3 py-1 transition-colors"
            style={{
              border: "1px solid var(--outline-variant)",
              color: page === 0 ? "var(--outline-variant)" : "var(--on-surface-variant)",
              cursor: page === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← PREV
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="label-caps px-3 py-1 transition-colors"
            style={{
              border: "1px solid var(--outline-variant)",
              color: page >= totalPages - 1 ? "var(--outline-variant)" : "var(--on-surface-variant)",
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
            }}
          >
            NEXT →
          </button>
        </div>
      </div>

    </div>
  )
}
