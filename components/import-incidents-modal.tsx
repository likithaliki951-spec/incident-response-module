"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { batchImportIncidents, type RawIncidentImportItem, type BatchImportResult } from "@/app/actions"
import { classifyRisk, calculateRisk, type Incident, type Severity, type IncidentStatus } from "@/lib/irm"
import { SeverityBadge, StatusBadge, RiskMeter } from "@/components/badges"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileCode,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calculator,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react"

interface ParsedPreviewRow {
  rowNum: number
  raw: RawIncidentImportItem
  isValid: boolean
  isDuplicate: boolean
  errorMessage?: string
  computedRisk?: number
  computedSeverity?: Severity
  previewId: string
}

export function ImportIncidentsModal({ existingIncidents }: { existingIncidents: Incident[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([])
  const [activeFilter, setActiveFilter] = useState<"ALL" | "VALID" | "DUPLICATES" | "ERRORS">("ALL")
  const [importSummary, setImportSummary] = useState<BatchImportResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const existingIdSet = new Set(existingIncidents.map((i) => i.incident_id.toUpperCase().trim()))

  function handleReset() {
    setFile(null)
    setParseError(null)
    setPreviewRows([])
    setImportSummary(null)
    setActiveFilter("ALL")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClose() {
    setOpen(false)
    handleReset()
  }

  // Parse CSV text respecting quoted commas and escaped quotes (RFC 4180)
  function parseCsvRecords(text: string): Record<string, string>[] {
    const lines: string[] = []
    let currentLine = ""
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentLine += '"'
          i++ // skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if ((char === "\r" || char === "\n") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") i++ // handle CRLF
        if (currentLine.trim()) lines.push(currentLine)
        currentLine = ""
      } else {
        currentLine += char
      }
    }
    if (currentLine.trim()) lines.push(currentLine)

    if (lines.length < 2) return []

    // Parse header
    const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/['"]/g, ""))

    const records: Record<string, string>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i])
      if (values.length === 0 || (values.length === 1 && !values[0].trim())) continue

      const record: Record<string, string> = {}
      headers.forEach((h, idx) => {
        record[h] = values[idx]?.trim() ?? ""
      })
      records.push(record)
    }

    return records
  }

  function splitCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  function normalizeRecord(raw: Record<string, unknown>): RawIncidentImportItem {
    // Find incident_name
    const name = String(raw.incident_name ?? raw.name ?? raw.title ?? "").trim()
    const id = String(raw.incident_id ?? raw.id ?? "").trim()
    const desc = String(raw.description ?? raw.desc ?? raw.details ?? "").trim()
    const source = String(raw.source ?? raw.origin ?? "").trim()
    const rawLikelihood = raw.likelihood ?? raw.probability ?? raw.likehood ?? ""
    const rawImpact = raw.impact ?? raw.damage ?? raw.severity_score ?? ""
    const rawStatus = raw.status ?? raw.state ?? "Open"

    return {
      incident_id: id || undefined,
      incident_name: name,
      description: desc || undefined,
      likelihood: Number(rawLikelihood),
      impact: Number(rawImpact),
      status: String(rawStatus) as IncidentStatus,
      source: source || undefined,
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setParseError(null)
    setImportSummary(null)
    setFile(selectedFile)
    setIsParsing(true)

    // Security & sanity checks
    if (selectedFile.size > 5 * 1024 * 1024) {
      setParseError("File exceeds maximum allowed size limit of 5 MB.")
      setIsParsing(false)
      return
    }

    try {
      const text = await selectedFile.text()
      const isJson = selectedFile.name.endsWith(".json") || selectedFile.type.includes("json")
      let rawRecords: Record<string, unknown>[] = []

      if (isJson) {
        try {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            rawRecords = parsed
          } else if (parsed && typeof parsed === "object") {
            const arr = parsed.incidents || parsed.records || parsed.data || []
            if (Array.isArray(arr)) {
              rawRecords = arr
            } else {
              throw new Error("JSON must contain an array of incident objects.")
            }
          }
        } catch (jsonErr) {
          throw new Error(`Malformed JSON file: ${jsonErr instanceof Error ? jsonErr.message : "Parse error"}`)
        }
      } else {
        // Assume CSV
        rawRecords = parseCsvRecords(text)
        if (rawRecords.length === 0) {
          throw new Error("CSV file does not contain valid headers or data rows.")
        }
      }

      if (rawRecords.length > 500) {
        throw new Error(`Maximum 500 records per file import allowed. File contains ${rawRecords.length} records.`)
      }

      // Process each row
      const processed: ParsedPreviewRow[] = []
      const fileIdSet = new Set<string>()

      for (let i = 0; i < rawRecords.length; i++) {
        const rowNum = i + 1
        const item = normalizeRecord(rawRecords[i])
        let errorMessage: string | undefined
        let isDuplicate = false
        let isValid = true

        // 1. Validate required incident_name
        if (!item.incident_name) {
          isValid = false
          errorMessage = "Missing required 'incident_name'"
        }

        // 2. Validate likelihood range (0 to 1)
        if (isValid) {
          if (!Number.isFinite(item.likelihood) || isNaN(item.likelihood)) {
            isValid = false
            errorMessage = "Likelihood must be a numeric value"
          } else if (item.likelihood < 0 || item.likelihood > 1) {
            isValid = false
            errorMessage = `Likelihood '${item.likelihood}' out of range (must be 0.00 to 1.00)`
          }
        }

        // 3. Validate impact range (0 to 100)
        if (isValid) {
          if (!Number.isFinite(item.impact) || isNaN(item.impact)) {
            isValid = false
            errorMessage = "Impact must be a numeric integer"
          } else if (item.impact < 0 || item.impact > 100) {
            isValid = false
            errorMessage = `Impact '${item.impact}' out of range (must be 0 to 100)`
          }
        }

        // 4. Duplicate ID check
        let previewId = item.incident_id || `INC-AUTO-${(rowNum).toString().padStart(3, "0")}`
        if (item.incident_id) {
          const upper = item.incident_id.toUpperCase().trim()
          if (existingIdSet.has(upper)) {
            isDuplicate = true
            isValid = false
            errorMessage = `Duplicate ID '${item.incident_id}' already exists in database`
          } else if (fileIdSet.has(upper)) {
            isDuplicate = true
            isValid = false
            errorMessage = `Duplicate ID '${item.incident_id}' repeated within file`
          } else {
            fileIdSet.add(upper)
          }
        }

        let computedRisk: number | undefined
        let computedSeverity: Severity | undefined

        if (isValid) {
          const au = calculateRisk(item.likelihood, item.impact)
          computedRisk = au.riskScore
          computedSeverity = au.severity
        }

        processed.push({
          rowNum,
          raw: item,
          isValid,
          isDuplicate,
          errorMessage,
          computedRisk,
          computedSeverity,
          previewId,
        })
      }

      setPreviewRows(processed)
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file.")
      setPreviewRows([])
    } finally {
      setIsParsing(false)
    }
  }

  function handleConfirmImport() {
    const validItems = previewRows.filter((r) => r.isValid).map((r) => r.raw)
    if (validItems.length === 0) return

    startTransition(async () => {
      const result = await batchImportIncidents(validItems)
      setImportSummary(result)
      // Refresh Next.js server components so the dashboard and tables sync immediately
      router.refresh()
    })
  }

  function downloadSampleCsv() {
    const link = document.createElement("a")
    link.href = "/irm_incidents_template.csv"
    link.download = "irm_incidents_template.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const validCount = previewRows.filter((r) => r.isValid).length
  const duplicateCount = previewRows.filter((r) => r.isDuplicate).length
  const errorCount = previewRows.filter((r) => !r.isValid && !r.isDuplicate).length

  const displayedRows = previewRows.filter((r) => {
    if (activeFilter === "VALID") return r.isValid
    if (activeFilter === "DUPLICATES") return r.isDuplicate
    if (activeFilter === "ERRORS") return !r.isValid && !r.isDuplicate
    return true
  })

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-border bg-card hover:bg-muted text-foreground"
      >
        <Upload className="h-4 w-4 text-primary" />
        Import Incidents
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={handleClose} aria-hidden />

          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Import Incidents (CSV / JSON)</h2>
                  <p className="text-xs text-muted-foreground">
                    Bulk ingest security cases with Arithmetic Unit (AU) risk validation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadSampleCsv}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  title="Download standard CSV template"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  Sample CSV Template
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Post-Import Summary Dialog State */}
              {importSummary ? (
                <div className="space-y-4 py-4">
                  <div
                    className={`rounded-lg border p-4 ${
                      importSummary.importedCount > 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Batch Ingestion Completed</span>
                    </div>
                    <p className="text-xs mt-1 text-muted-foreground">
                      Results have been synchronized with the data service layer and pipeline telemetry.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Total Rows</p>
                      <p className="font-mono text-2xl font-bold">{importSummary.totalProcessed}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase text-emerald-400">Imported</p>
                      <p className="font-mono text-2xl font-bold text-emerald-400">
                        {importSummary.importedCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-[11px] uppercase text-amber-400">Skipped (Dupes)</p>
                      <p className="font-mono text-2xl font-bold text-amber-400">
                        {importSummary.skippedDuplicatesCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-[11px] uppercase text-red-400">Invalid / Failed</p>
                      <p className="font-mono text-2xl font-bold text-red-400">
                        {importSummary.invalidCount}
                      </p>
                    </div>
                  </div>

                  {importSummary.errors.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 max-h-40 overflow-y-auto text-xs">
                      <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                        Exceptions Logged ({importSummary.errors.length})
                      </p>
                      {importSummary.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-muted-foreground">
                          <span className="font-mono text-amber-400">Row #{err.row}:</span>
                          <span>{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button onClick={handleClose}>Close & View Updated Incidents</Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Upload Zone */}
                  {!file && (
                    <div className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.json,text/csv,application/json"
                        onChange={handleFileSelected}
                        className="hidden"
                        id="csv-file-upload"
                      />
                      <label
                        htmlFor="csv-file-upload"
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl hover:border-primary/60 cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all text-center space-y-2.5"
                      >
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Click to select CSV or JSON file</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Max 5 MB · Up to 500 records · Strict data-only parsing
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-chart-2" /> .csv
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-mono">
                            <FileCode className="h-3.5 w-3.5 text-chart-3" /> .json
                          </span>
                        </div>
                      </label>

                      {/* Instructions Card */}
                      <div className="rounded-lg border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground space-y-2">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Info className="h-4 w-4 text-primary" />
                          <span>Expected Schema & Arithmetic Unit Units</span>
                        </div>
                        <p>
                          Accepted columns: <code className="font-mono text-primary font-semibold">incident_name</code> (required),{" "}
                          <code className="font-mono text-foreground">likelihood</code> (0.00 to 1.00),{" "}
                          <code className="font-mono text-foreground">impact</code> (0 to 100),{" "}
                          <code className="font-mono text-foreground">description</code>,{" "}
                          <code className="font-mono text-foreground">status</code> (Open / Investigating / Resolved),{" "}
                          <code className="font-mono text-foreground">source</code>, and optional <code className="font-mono text-foreground">incident_id</code>.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Arithmetic Unit automatically computes <code className="font-mono text-foreground font-semibold">Risk = round(Likelihood × Impact)</code> and classifies severity.
                        </p>
                      </div>
                    </div>
                  )}

                  {parseError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-start gap-2">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                      <div>
                        <p className="font-semibold text-red-200">File Processing Error</p>
                        <p>{parseError}</p>
                      </div>
                    </div>
                  )}

                  {isParsing && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
                      <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                      <p>Parsing records and evaluating AU risk score equations…</p>
                    </div>
                  )}

                  {/* Preview Area */}
                  {file && !isParsing && previewRows.length > 0 && (
                    <div className="space-y-4">
                      {/* File Meta and Filter Tabs */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">({previewRows.length} rows detected)</span>
                          <button
                            onClick={handleReset}
                            className="text-xs text-primary hover:underline ml-2"
                          >
                            Choose another file
                          </button>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            onClick={() => setActiveFilter("ALL")}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              activeFilter === "ALL"
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            All ({previewRows.length})
                          </button>
                          <button
                            onClick={() => setActiveFilter("VALID")}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              activeFilter === "VALID"
                                ? "bg-emerald-600 text-white font-medium"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            }`}
                          >
                            Valid ({validCount})
                          </button>
                          {duplicateCount > 0 && (
                            <button
                              onClick={() => setActiveFilter("DUPLICATES")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeFilter === "DUPLICATES"
                                  ? "bg-amber-600 text-white font-medium"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                              }`}
                            >
                              Duplicates ({duplicateCount})
                            </button>
                          )}
                          {errorCount > 0 && (
                            <button
                              onClick={() => setActiveFilter("ERRORS")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeFilter === "ERRORS"
                                  ? "bg-red-600 text-white font-medium"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              }`}
                            >
                              Invalid ({errorCount})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div className="rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0 border-b border-border text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium w-12">#</th>
                              <th className="px-3 py-2 text-left font-medium">Status</th>
                              <th className="px-3 py-2 text-left font-medium">Incident ID</th>
                              <th className="px-3 py-2 text-left font-medium">Name</th>
                              <th className="px-3 py-2 text-left font-medium">AU Risk (L × I)</th>
                              <th className="px-3 py-2 text-left font-medium">Severity</th>
                              <th className="px-3 py-2 text-left font-medium">Notes / Errors</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {displayedRows.map((row) => (
                              <tr
                                key={row.rowNum}
                                className={`transition-colors ${
                                  !row.isValid
                                    ? row.isDuplicate
                                      ? "bg-amber-500/5"
                                      : "bg-red-500/5"
                                    : "hover:bg-muted/20"
                                }`}
                              >
                                <td className="px-3 py-2 font-mono text-muted-foreground">{row.rowNum}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {row.isValid ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                      <CheckCircle2 className="h-3 w-3" /> Ready
                                    </span>
                                  ) : row.isDuplicate ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                                      <AlertTriangle className="h-3 w-3" /> Duplicate
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium">
                                      <XCircle className="h-3 w-3" /> Invalid
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                                  {row.previewId}
                                  {!row.raw.incident_id && (
                                    <span className="ml-1 text-[9px] text-primary">(Auto)</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-medium text-foreground max-w-xs truncate">
                                  {row.raw.incident_name || <span className="text-red-400 italic">Missing name</span>}
                                </td>
                                <td className="px-3 py-2 font-mono whitespace-nowrap">
                                  {row.isValid ? (
                                    <div className="flex items-center gap-1.5">
                                      <span>
                                        {row.raw.likelihood.toFixed(2)} × {row.raw.impact} =
                                      </span>
                                      <strong className="text-foreground">{row.computedRisk}</strong>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {row.computedSeverity ? (
                                    <SeverityBadge severity={row.computedSeverity} />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                                  {row.errorMessage ? (
                                    <span className={row.isDuplicate ? "text-amber-400" : "text-red-400 font-medium"}>
                                      {row.errorMessage}
                                    </span>
                                  ) : (
                                    <span>{row.raw.status || "Open"}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Confirmation Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                          <span>
                            Ready to import <strong className="text-foreground">{validCount}</strong> valid incidents
                          </span>
                          {(duplicateCount > 0 || errorCount > 0) && (
                            <span className="text-amber-400 ml-1">
                              ({duplicateCount} duplicates & {errorCount} errors will be skipped)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={handleReset} disabled={pending}>
                            Clear
                          </Button>
                          <Button onClick={handleConfirmImport} disabled={pending || validCount === 0}>
                            {pending ? "Importing to IRM…" : `Confirm & Import (${validCount})`}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
