"use client"

import React, { useState, useRef, useCallback } from "react"
import Link from "next/link"

/* ─── Types ─────────────────────────────────────────────── */

type Shoe = { id: string; brand: string | null; model: string | null }

type LapData = {
  lap_number: number
  lap_intent: string
  distance: number | null
  time: string | null
  avg_pace: string | null
  avg_hr: number | null
}

type ParsedRun = {
  date: string | null
  title: string | null
  total_distance: number | null
  total_time: string | null
  avg_pace: string | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  avg_gct: number | null
  avg_vertical_oscillation: number | null
  single_intent: boolean
  laps: LapData[]
  timeseries: unknown[]
}

type Stage = "idle" | "parsing" | "parsed" | "uploading" | "success" | "error"

/* ─── Section header ─────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="flex items-center px-4 py-2"
      style={{
        borderBottom: "1px solid var(--outline-variant)",
        backgroundColor: "var(--surface-container-low)",
      }}
    >
      <span className="label-caps text-[var(--on-surface)]">{label}</span>
    </div>
  )
}

/* ─── Summary row ────────────────────────────────────────── */

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <React.Fragment>
      <div
        className="flex items-center px-4 py-2 label-caps text-[var(--on-surface-variant)]"
        style={{ backgroundColor: "var(--surface-container-low)" }}
      >
        {label}
      </div>
      <div
        className="flex items-center px-4 py-2 code-data text-[var(--on-surface)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {value}
      </div>
    </React.Fragment>
  )
}

/* ─── Main component ─────────────────────────────────────── */

export default function UploadClient({ shoes }: { shoes: Shoe[] }) {
  const [stage, setStage]         = useState<Stage>("idle")
  const [file, setFile]           = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [parsed, setParsed]       = useState<ParsedRun | null>(null)
  const [editedTitle, setEditedTitle] = useState("")
  const [runTypeTag, setRunTypeTag] = useState("")
  const [shoeId, setShoeId]       = useState("")
  const [notes, setNotes]         = useState("")
  const [resultRunId, setResultRunId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const dragCounter   = useRef(0)

  /* ── File handling ──────────────────────────────────────── */

  const acceptFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".fit")) return
    setFile(f)
    setParsed(null)
    setResultRunId(null)
    setErrorMsg(null)
    setStage("idle")
  }, [])

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  /* ── Parse ──────────────────────────────────────────────── */

  async function handleParse() {
    if (!file) return
    setStage("parsing")
    setErrorMsg(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/parse-fit", { method: "POST", body: fd })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok || data.error) {
        setErrorMsg(String(data.error ?? "PARSE_FAILED"))
        setStage("error")
        return
      }
      const run = data as ParsedRun
      setParsed(run)
      setEditedTitle(run.title ?? "")
      setRunTypeTag(run.title ?? "")
      setStage("parsed")
    } catch {
      setErrorMsg("NETWORK_ERROR")
      setStage("error")
    }
  }

  /* ── Upload ─────────────────────────────────────────────── */

  async function handleUpload() {
    if (!parsed) return
    setStage("uploading")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/upload-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedRun:    parsed,
          title:        editedTitle || null,
          run_type_tag: runTypeTag || null,
          shoe_id:      shoeId     || null,
          notes:        notes      || null,
        }),
      })
      const data = await res.json() as { run_id?: string; error?: string }
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "UPLOAD_FAILED")
        setStage("error")
        return
      }
      setResultRunId(data.run_id ?? null)
      setStage("success")
    } catch {
      setErrorMsg("NETWORK_ERROR")
      setStage("error")
    }
  }

  /* ── Reset ──────────────────────────────────────────────── */

  function reset() {
    setStage("idle")
    setFile(null)
    setParsed(null)
    setEditedTitle("")
    setRunTypeTag("")
    setShoeId("")
    setNotes("")
    setErrorMsg(null)
    setResultRunId(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  /* ── Derived ────────────────────────────────────────────── */

  const stageLabel: Record<Stage, string> = {
    idle:      "WAITING",
    parsing:   "PARSING",
    parsed:    "PREVIEW",
    uploading: "UPLOADING",
    success:   "SUCCESS",
    error:     "ERROR",
  }

  const stageColor =
    stage === "success" ? "var(--teal)"
    : stage === "error" ? "#e05252"
    : "var(--on-surface-variant)"

  const dropActive = isDragging || isHovering
  const hasParsed  = parsed !== null && (stage === "parsed" || stage === "uploading" || stage === "success" || stage === "error")

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>

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
          <span className="label-caps text-[var(--teal)]">UPLOAD_CENTER</span>
          <span className="label-caps text-[var(--on-surface-variant)]">:: FIT_IMPORT</span>
        </div>
        <span className="label-caps" style={{ color: stageColor }}>
          {stageLabel[stage]}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-col overflow-auto flex-1">

        {/* ── 01 FILE_SELECT ─────────────────────────────── */}
        <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
          <SectionHeader label="01_FILE_SELECT" />

          <div className="p-4 flex flex-col gap-3">
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: `1px dashed ${dropActive || file ? "var(--teal)" : "var(--outline)"}`,
                backgroundColor: dropActive ? "rgba(45, 219, 222, 0.05)" : "transparent",
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.1s, background-color 0.1s",
              }}
            >
              {file ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="code-data" style={{ color: "var(--teal)" }}>
                    {file.name}
                  </span>
                  <span className="label-caps text-[var(--on-surface-variant)]">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="label-caps text-[var(--on-surface-variant)]">
                    DROP .FIT FILE HERE OR CLICK TO SELECT
                  </span>
                  <span
                    className="code-data text-[var(--on-surface-variant)]"
                    style={{ fontSize: 11, opacity: 0.5 }}
                  >
                    GARMIN .FIT FORMAT ONLY
                  </span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".fit"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) acceptFile(f)
              }}
            />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleParse()}
                disabled={!file || stage === "parsing" || stage === "uploading"}
                className="label-caps px-4 py-2"
                style={{
                  backgroundColor: file && stage !== "parsing" && stage !== "uploading"
                    ? "var(--teal)" : "var(--surface-container-high)",
                  color: file && stage !== "parsing" && stage !== "uploading"
                    ? "var(--on-teal)" : "var(--on-surface-variant)",
                  cursor: file && stage !== "parsing" && stage !== "uploading"
                    ? "pointer" : "not-allowed",
                }}
              >
                {stage === "parsing" ? "PARSING..." : "PARSE"}
              </button>

              {stage !== "idle" && stage !== "parsing" && (
                <button
                  onClick={reset}
                  className="label-caps px-3 py-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
                  style={{ border: "1px solid var(--outline-variant)" }}
                >
                  RESET
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 02 ACTIVITY_SUMMARY (after parse) ──────────── */}
        {hasParsed && parsed && (
          <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <SectionHeader label="02_ACTIVITY_SUMMARY" />

            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: "140px 1fr",
                backgroundColor: "var(--outline-variant)",
              }}
            >
              {/* TITLE — editable */}
              <div
                className="flex items-center px-4 py-2 label-caps text-[var(--on-surface-variant)]"
                style={{ backgroundColor: "var(--surface-container-low)" }}
              >
                TITLE
              </div>
              <div
                className="flex items-center px-4 py-2"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  disabled={stage === "uploading" || stage === "success"}
                  className="code-data text-[var(--on-surface)] bg-transparent outline-none w-full"
                  style={{
                    borderBottom: "1px solid var(--outline-variant)",
                    caretColor: "var(--teal)",
                  }}
                  spellCheck={false}
                />
              </div>
              <SummaryRow label="DATE"     value={parsed.date ?? "--"} />
              <SummaryRow
                label="DISTANCE"
                value={parsed.total_distance != null ? `${parsed.total_distance.toFixed(2)} km` : "--"}
              />
              <SummaryRow label="TIME"     value={parsed.total_time ?? "--"} />
              <SummaryRow label="AVG_PACE" value={parsed.avg_pace ?? "--"} />
              <SummaryRow
                label="AVG_HR"
                value={parsed.avg_hr != null ? `${parsed.avg_hr} bpm` : "--"}
              />
              <SummaryRow
                label="CADENCE"
                value={parsed.avg_cadence != null ? `${parsed.avg_cadence} spm` : "--"}
              />
              {parsed.avg_gct != null && (
                <SummaryRow label="GCT" value={`${parsed.avg_gct} ms`} />
              )}
            </div>

            {/* Lap table for multi-intent runs */}
            {!parsed.single_intent && parsed.laps.length > 1 && (
              <div style={{ borderTop: "1px solid var(--outline-variant)" }}>
                <div
                  className="grid px-4 py-1.5 flex-shrink-0"
                  style={{
                    gridTemplateColumns: "46px 1fr 70px 70px 70px 60px",
                    borderBottom: "1px solid var(--outline-variant)",
                    backgroundColor: "var(--surface-container-low)",
                  }}
                >
                  {["LAP", "INTENT", "DIST", "TIME", "PACE", "AVG_HR"].map((col) => (
                    <span key={col} className="label-caps text-[var(--on-surface-variant)]">
                      {col}
                    </span>
                  ))}
                </div>
                {parsed.laps.map((lap) => (
                  <div
                    key={lap.lap_number}
                    className="grid px-4 py-2"
                    style={{
                      gridTemplateColumns: "46px 1fr 70px 70px 70px 60px",
                      borderBottom: "1px solid var(--outline-variant)",
                    }}
                  >
                    <span className="code-data text-[var(--on-surface-variant)]">
                      {lap.lap_number}
                    </span>
                    <span className="code-data" style={{ color: "var(--teal)" }}>
                      {lap.lap_intent}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {lap.distance != null ? `${lap.distance.toFixed(2)}k` : "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {lap.time ?? "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {lap.avg_pace ?? "--"}
                    </span>
                    <span className="code-data text-[var(--on-surface)]">
                      {lap.avg_hr ?? "--"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 03 METADATA ────────────────────────────────── */}
        {hasParsed && (
          <div style={{ borderBottom: "1px solid var(--outline-variant)" }}>
            <SectionHeader label="03_METADATA" />

            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: "140px 1fr",
                backgroundColor: "var(--outline-variant)",
              }}
            >
              {/* RUN_TYPE_TAG */}
              <div
                className="flex items-center px-4 py-2 label-caps text-[var(--on-surface-variant)]"
                style={{ backgroundColor: "var(--surface-container-low)" }}
              >
                RUN_TYPE_TAG
              </div>
              <div
                className="flex items-center px-4 py-2"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <input
                  type="text"
                  value={runTypeTag}
                  onChange={(e) => setRunTypeTag(e.target.value)}
                  disabled={stage === "uploading" || stage === "success"}
                  className="code-data text-[var(--on-surface)] bg-transparent outline-none w-full"
                  style={{
                    borderBottom: "1px solid var(--outline-variant)",
                    caretColor: "var(--teal)",
                  }}
                  placeholder="e.g. Easy Run, Long Run, Tempo"
                  spellCheck={false}
                />
              </div>

              {/* SHOE_ID */}
              <div
                className="flex items-center px-4 py-2 label-caps text-[var(--on-surface-variant)]"
                style={{ backgroundColor: "var(--surface-container-low)" }}
              >
                SHOE_ID
              </div>
              <div
                className="flex items-center px-4 py-2"
                style={{ backgroundColor: "var(--surface)" }}
              >
                {shoes.length === 0 ? (
                  <span
                    className="code-data text-[var(--on-surface-variant)]"
                    style={{ opacity: 0.5 }}
                  >
                    No shoes configured — add in Gear Lab
                  </span>
                ) : (
                  <select
                    value={shoeId}
                    onChange={(e) => setShoeId(e.target.value)}
                    disabled={stage === "uploading" || stage === "success"}
                    className="code-data text-[var(--on-surface)] outline-none w-full"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "none",
                      borderBottom: "1px solid var(--outline-variant)",
                      caretColor: "var(--teal)",
                    }}
                  >
                    <option value="">— None —</option>
                    {shoes.map((shoe) => (
                      <option key={shoe.id} value={shoe.id}>
                        {[shoe.brand, shoe.model].filter(Boolean).join(" ") || shoe.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* NOTES */}
              <div
                className="flex items-start px-4 py-2.5 label-caps text-[var(--on-surface-variant)]"
                style={{ backgroundColor: "var(--surface-container-low)" }}
              >
                NOTES
              </div>
              <div
                className="flex items-start px-4 py-2"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={stage === "uploading" || stage === "success"}
                  rows={3}
                  className="code-data text-[var(--on-surface)] bg-transparent outline-none w-full resize-none"
                  style={{
                    border: "1px solid var(--outline-variant)",
                    caretColor: "var(--teal)",
                    padding: "6px 8px",
                  }}
                  placeholder="Optional session notes..."
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Upload button + result ──────────────────────── */}
        {hasParsed && (
          <div className="flex flex-col gap-3 px-4 py-3">

            {stage !== "success" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handleUpload()}
                  disabled={stage === "uploading"}
                  className="label-caps px-4 py-2"
                  style={{
                    backgroundColor: stage === "uploading"
                      ? "var(--surface-container-high)" : "var(--teal)",
                    color: stage === "uploading"
                      ? "var(--on-surface-variant)" : "var(--on-teal)",
                    cursor: stage === "uploading" ? "not-allowed" : "pointer",
                  }}
                >
                  {stage === "uploading" ? "UPLOADING..." : "CONFIRM_UPLOAD"}
                </button>

                {stage === "error" && (
                  <button
                    onClick={() => setStage("parsed")}
                    className="label-caps px-3 py-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
                    style={{ border: "1px solid var(--outline-variant)" }}
                  >
                    RETRY
                  </button>
                )}
              </div>
            )}

            {/* Success banner */}
            {stage === "success" && resultRunId && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{
                  border: "1px solid var(--teal)",
                  backgroundColor: "rgba(45, 219, 222, 0.05)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block flex-shrink-0"
                    style={{ width: 8, height: 8, backgroundColor: "var(--teal)" }}
                  />
                  <span className="label-caps" style={{ color: "var(--teal)" }}>SUCCESS</span>
                  <span className="code-data text-[var(--on-surface-variant)]">
                    RUN_ID: {resultRunId}
                  </span>
                </div>
                <Link
                  href={`/dashboard/run-analysis?run_id=${resultRunId}`}
                  className="label-caps px-3 py-1.5 hover:bg-[var(--teal)] hover:text-[var(--on-teal)] transition-colors"
                  style={{
                    border: "1px solid var(--teal)",
                    color: "var(--teal)",
                    textDecoration: "none",
                  }}
                >
                  VIEW_ANALYSIS →
                </Link>
              </div>
            )}

            {/* Error banner */}
            {stage === "error" && errorMsg && (
              <div
                className="px-4 py-3"
                style={{
                  border: "1px solid #e05252",
                  backgroundColor: "rgba(224, 82, 82, 0.05)",
                }}
              >
                <span className="label-caps" style={{ color: "#e05252" }}>
                  ERR: {errorMsg}
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
