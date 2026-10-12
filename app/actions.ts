"use server"

import { revalidatePath } from "next/cache"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { memoryStore } from "@/lib/mock-data"
import { getCurrentTeamMember } from "@/lib/auth"
import {
  calculateRisk,
  type Incident,
  type IncidentStatus,
  type MalwareTest,
  type YaraRule,
  type IncidentReport,
  type Severity,
} from "@/lib/irm"

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ------------------------------------------------------------------------------
// 1. CREATE INCIDENT
// ------------------------------------------------------------------------------
export async function createIncident(formData: FormData): Promise<ActionResult<Incident>> {
  const member = await getCurrentTeamMember()

  const name = String(formData.get("incident_name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const likelihoodRaw = Number(formData.get("likelihood"))
  const impactRaw = Number(formData.get("impact"))

  if (!name || name.length > 255) {
    return { ok: false, error: "Incident name is required and must not exceed 255 characters." }
  }

  if (description.length > 4000) {
    return { ok: false, error: "Description must not exceed 4000 characters." }
  }

  if (!Number.isFinite(likelihoodRaw) || likelihoodRaw < 0 || likelihoodRaw > 1) {
    return {
      ok: false,
      error: "Likelihood must be a valid number between 0.0 and 1.0.",
    }
  }

  if (!Number.isFinite(impactRaw) || impactRaw < 0 || impactRaw > 100) {
    return {
      ok: false,
      error: "Impact must be a valid integer between 0 and 100.",
    }
  }

  // AU: Arithmetic Unit computes Risk = Likelihood × Impact (0 - 100)
  const { riskScore, severity } = calculateRisk(likelihoodRaw, impactRaw)

  // Generate unique incident ID
  const incidentId = `INC-${Date.now().toString().slice(-6)}`
  const now = new Date().toISOString()

  const newIncident: Incident = {
    id: `inc-${Date.now()}`,
    incident_id: incidentId,
    incident_name: name,
    severity,
    risk_score: riskScore,
    likelihood: likelihoodRaw,
    impact: Math.round(impactRaw),
    status: "Open" satisfies IncidentStatus,
    description: description || null,
    created_at: now,
  }

  // 1. Authenticated Team Member: Save to Live Supabase Database
  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase.from("incidents").insert({
        incident_id: incidentId,
        incident_name: name,
        severity,
        risk_score: riskScore,
        likelihood: likelihoodRaw,
        impact: Math.round(impactRaw),
        status: "Open",
        description: description || null,
        created_at: now,
      })

      if (error) {
        console.error("[IRM Action] Supabase insert failed:", error.message)
        return { ok: false, error: `Database insert failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase connection error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  // 2. Demo Mode (or syncing local cache): Write to in-memory store
  memoryStore.addIncident(newIncident)
  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true, data: newIncident }
}

// ------------------------------------------------------------------------------
// 2. UPDATE INCIDENT STATUS
// ------------------------------------------------------------------------------
export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
): Promise<ActionResult> {
  const member = await getCurrentTeamMember()

  const cleanId = String(id || "").trim()
  if (!cleanId) {
    return { ok: false, error: "Invalid incident ID." }
  }

  const validStatuses: IncidentStatus[] = ["Open", "Investigating", "Resolved"]
  if (!validStatuses.includes(status)) {
    return { ok: false, error: "Invalid incident status." }
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase
        .from("incidents")
        .update({ status })
        .or(`id.eq.${cleanId},incident_id.eq.${cleanId}`)

      if (error) {
        console.error("[IRM Action] Supabase update failed:", error.message)
        return { ok: false, error: `Database update failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase update error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.updateIncidentStatus(cleanId, status)
  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true }
}

// ------------------------------------------------------------------------------
// 3. DELETE INCIDENT
// ------------------------------------------------------------------------------
export async function deleteIncident(id: string): Promise<ActionResult> {
  const member = await getCurrentTeamMember()

  const cleanId = String(id || "").trim()
  if (!cleanId) {
    return { ok: false, error: "Invalid incident ID." }
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase
        .from("incidents")
        .delete()
        .or(`id.eq.${cleanId},incident_id.eq.${cleanId}`)

      if (error) {
        console.error("[IRM Action] Supabase delete failed:", error.message)
        return { ok: false, error: `Database delete failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase delete error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.deleteIncident(cleanId)
  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true }
}

// ------------------------------------------------------------------------------
// 4. RECORD MALWARE TEST
// ------------------------------------------------------------------------------
export async function recordMalwareTest(payload: {
  fileName: string
  fileSize: number
  sha256Hash: string
  detectionStatus: "Clean" | "Suspicious" | "Simulated Malicious" | "EICAR Standard Test" | "Unknown"
  riskLevel: Severity | "Clean" | "Unknown"
  scannerType: string
  scanNotes?: string
}): Promise<ActionResult<MalwareTest>> {
  const member = await getCurrentTeamMember()

  const fileName = String(payload.fileName ?? "").trim().slice(0, 255)
  const fileSize = Number(payload.fileSize)
  const sha256Hash = String(payload.sha256Hash ?? "").trim().toLowerCase()

  if (!fileName) {
    return { ok: false, error: "File name is required." }
  }

  if (!Number.isFinite(fileSize) || fileSize < 0) {
    return { ok: false, error: "Invalid file size." }
  }

  if (!/^[a-f0-9]{64}$/.test(sha256Hash)) {
    return { ok: false, error: "Invalid SHA-256 hash format (must be 64 hexadecimal characters)." }
  }

  const validStatuses = ["Clean", "Suspicious", "Simulated Malicious", "EICAR Standard Test", "Unknown"]
  if (!validStatuses.includes(payload.detectionStatus)) {
    return { ok: false, error: "Invalid detection status." }
  }

  const now = new Date().toISOString()
  const testRecord: MalwareTest = {
    id: `mlw-${Date.now()}`,
    file_name: fileName,
    file_size: fileSize,
    sha256_hash: sha256Hash,
    detection_status: payload.detectionStatus,
    risk_level: payload.riskLevel,
    scanner_type: String(payload.scannerType ?? "Simulated Heuristic Scanner").trim().slice(0, 100),
    scan_notes: payload.scanNotes ? String(payload.scanNotes).trim().slice(0, 2000) : undefined,
    created_at: now,
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase.from("malware_tests").insert({
        file_name: testRecord.file_name,
        file_size: testRecord.file_size,
        sha256_hash: testRecord.sha256_hash,
        detection_status: testRecord.detection_status,
        risk_level: testRecord.risk_level,
        scanner_type: testRecord.scanner_type,
        scan_notes: testRecord.scan_notes,
        created_at: now,
      })

      if (error) {
        console.error("[IRM Action] Supabase malware test insert failed:", error.message)
        return { ok: false, error: `Database insert failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase malware test error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.addMalwareTest(testRecord)
  revalidatePath("/malware")
  revalidatePath("/threats")

  return { ok: true, data: testRecord }
}

// ------------------------------------------------------------------------------
// 5. TOGGLE YARA RULE
// ------------------------------------------------------------------------------
export async function toggleYaraRule(id: string, active: boolean): Promise<ActionResult> {
  const member = await getCurrentTeamMember()

  const cleanId = String(id || "").trim()
  if (!cleanId) {
    return { ok: false, error: "Invalid rule identifier." }
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      // Safe matching: if cleanId is numeric, match id OR rule_id. If text (like YARA-001), match rule_id
      let query = supabase.from("yara_rules").update({ is_active: Boolean(active) })
      if (/^\d+$/.test(cleanId)) {
        query = query.or(`id.eq.${cleanId},rule_id.eq.${cleanId}`)
      } else {
        query = query.eq("rule_id", cleanId)
      }

      const { error } = await query

      if (error) {
        console.error("[IRM Action] Supabase yara toggle failed:", error.message)
        return { ok: false, error: `Database update failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase yara toggle error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.toggleYaraRule(cleanId, Boolean(active))
  revalidatePath("/rules")

  return { ok: true }
}

// ------------------------------------------------------------------------------
// 6. CREATE YARA RULE
// ------------------------------------------------------------------------------
export async function createYaraRule(formData: FormData): Promise<ActionResult<YaraRule>> {
  const member = await getCurrentTeamMember()

  const name = String(formData.get("rule_name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const severityRaw = String(formData.get("severity") ?? "Medium").trim() as Severity
  const ruleContent = String(formData.get("rule_content") ?? "").trim()

  if (!name || name.length > 255) {
    return { ok: false, error: "Rule name is required and must not exceed 255 characters." }
  }

  if (!ruleContent || ruleContent.length > 10000) {
    return { ok: false, error: "YARA rule content is required and must not exceed 10,000 characters." }
  }

  const validSeverities: Severity[] = ["Critical", "High", "Medium", "Low"]
  const severity = validSeverities.includes(severityRaw) ? severityRaw : "Medium"

  const ruleId = `YARA-${(memoryStore.getYaraRules().length + 1).toString().padStart(3, "0")}`
  const now = new Date().toISOString()

  const newRule: YaraRule = {
    id: `yara-${Date.now()}`,
    rule_id: ruleId,
    rule_name: name,
    description: description || "Custom YARA pattern rule",
    severity,
    rule_content: ruleContent,
    is_active: true,
    created_at: now,
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase.from("yara_rules").insert({
        rule_id: ruleId,
        rule_name: name,
        description: description || null,
        severity,
        rule_content: ruleContent,
        is_active: true,
        created_at: now,
      })

      if (error) {
        console.error("[IRM Action] Supabase yara insert failed:", error.message)
        return { ok: false, error: `Database insert failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase yara error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.addYaraRule(newRule)
  revalidatePath("/rules")

  return { ok: true, data: newRule }
}

// ------------------------------------------------------------------------------
// 7. CREATE INCIDENT REPORT
// ------------------------------------------------------------------------------
export async function createIncidentReport(payload: {
  incidentId: string
  reportTitle: string
  riskScore: number
  severity: Severity
  analysisResult: string
  responseNotes: string
  generatedBy?: string
}): Promise<ActionResult<IncidentReport>> {
  const member = await getCurrentTeamMember()

  const incidentId = String(payload.incidentId ?? "").trim()
  const reportTitle = String(payload.reportTitle ?? "").trim().slice(0, 255)

  if (!incidentId || !reportTitle) {
    return { ok: false, error: "Incident ID and report title are required." }
  }

  const now = new Date().toISOString()
  const report: IncidentReport = {
    id: `rep-${Date.now()}`,
    incident_id: incidentId,
    report_title: reportTitle,
    risk_score: Math.max(0, Math.min(100, Number(payload.riskScore) || 0)),
    severity: payload.severity,
    analysis_result: String(payload.analysisResult ?? "").trim().slice(0, 5000),
    response_notes: String(payload.responseNotes ?? "").trim().slice(0, 5000),
    generated_by: member ? (member.name || member.email) : "SecOps Analyst (Demo)",
    created_at: now,
  }

  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Database client unavailable." }
      }

      const { error } = await supabase.from("reports").insert({
        incident_id: report.incident_id,
        report_title: report.report_title,
        risk_score: report.risk_score,
        severity: report.severity,
        analysis_result: report.analysis_result,
        response_notes: report.response_notes,
        generated_by: report.generated_by,
        created_at: now,
      })

      if (error) {
        console.error("[IRM Action] Supabase report insert failed:", error.message)
        return { ok: false, error: `Database insert failed: ${error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[IRM Action] Supabase report error:", msg)
      return { ok: false, error: `Database error: ${msg}` }
    }
  }

  memoryStore.addReport(report)
  revalidatePath("/reports")

  return { ok: true, data: report }
}

// ------------------------------------------------------------------------------
// 8. BATCH IMPORT INCIDENTS
// ------------------------------------------------------------------------------
export interface RawIncidentImportItem {
  incident_id?: string
  incident_name: string
  description?: string
  likelihood: number
  impact: number
  status?: IncidentStatus
  source?: string
}

export interface BatchImportResult {
  ok: boolean
  totalProcessed: number
  importedCount: number
  skippedDuplicatesCount: number
  invalidCount: number
  importedRecords: Incident[]
  errors: { row: number; identifier?: string; reason: string }[]
}

export async function batchImportIncidents(
  items: RawIncidentImportItem[]
): Promise<BatchImportResult> {
  const member = await getCurrentTeamMember()

  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      totalProcessed: 0,
      importedCount: 0,
      skippedDuplicatesCount: 0,
      invalidCount: 0,
      importedRecords: [],
      errors: [{ row: 0, reason: "No items provided for import." }],
    }
  }

  if (items.length > 500) {
    return {
      ok: false,
      totalProcessed: items.length,
      importedCount: 0,
      skippedDuplicatesCount: 0,
      invalidCount: items.length,
      importedRecords: [],
      errors: [
        {
          row: 0,
          reason: "Batch limit exceeded: A maximum of 500 incident records can be imported per batch.",
        },
      ],
    }
  }

  const errors: { row: number; identifier?: string; reason: string }[] = []
  const validToInsert: Incident[] = []
  let skippedDuplicatesCount = 0
  let invalidCount = 0

  // 1. Fetch existing incident IDs to prevent collisions
  const existingIdSet = new Set<string>()
  if (member && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data } = await supabase.from("incidents").select("incident_id")
        if (data) {
          data.forEach((row: { incident_id: string }) => {
            if (row.incident_id) existingIdSet.add(row.incident_id.trim().toUpperCase())
          })
        }
      }
    } catch (err) {
      console.warn("[IRM] Failed to fetch existing IDs from Supabase:", err)
    }
  }

  // Also include memory store existing incidents
  memoryStore.getIncidents().forEach((i) => {
    existingIdSet.add(i.incident_id.trim().toUpperCase())
  })

  // Track IDs within this batch to prevent batch-internal duplicates
  const batchIdSet = new Set<string>()

  // 2. Validate each item
  for (let idx = 0; idx < items.length; idx++) {
    const rowNum = idx + 1
    const raw = items[idx]

    const name = String(raw.incident_name ?? "").trim()
    if (!name || name.length > 255) {
      invalidCount++
      errors.push({
        row: rowNum,
        identifier: raw.incident_id || `Row #${rowNum}`,
        reason: "Missing or overly long 'incident_name' (max 255 characters).",
      })
      continue
    }

    const likelihood = Number(raw.likelihood)
    if (!Number.isFinite(likelihood) || likelihood < 0 || likelihood > 1) {
      invalidCount++
      errors.push({
        row: rowNum,
        identifier: name,
        reason: `Invalid likelihood '${raw.likelihood}' (must be a number between 0.00 and 1.00)`,
      })
      continue
    }

    const impact = Number(raw.impact)
    if (!Number.isFinite(impact) || impact < 0 || impact > 100) {
      invalidCount++
      errors.push({
        row: rowNum,
        identifier: name,
        reason: `Invalid impact '${raw.impact}' (must be an integer between 0 and 100)`,
      })
      continue
    }

    // Status normalization
    let status: IncidentStatus = "Open"
    if (raw.status) {
      const s = String(raw.status).trim().toLowerCase()
      if (s === "investigating") status = "Investigating"
      else if (s === "resolved") status = "Resolved"
      else status = "Open"
    }

    // Determine Incident ID
    let incId = String(raw.incident_id ?? "").trim()
    if (incId) {
      const upperId = incId.toUpperCase()
      if (existingIdSet.has(upperId) || batchIdSet.has(upperId)) {
        skippedDuplicatesCount++
        errors.push({
          row: rowNum,
          identifier: incId,
          reason: `Duplicate incident ID '${incId}' detected; row skipped`,
        })
        continue
      }
      batchIdSet.add(upperId)
    } else {
      incId = `INC-${Date.now().toString().slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`
      batchIdSet.add(incId.toUpperCase())
    }

    // Calculate risk
    const { riskScore, severity } = calculateRisk(likelihood, impact)

    const now = new Date().toISOString()
    validToInsert.push({
      id: `inc-import-${Date.now()}-${idx}`,
      incident_id: incId,
      incident_name: name,
      severity,
      risk_score: riskScore,
      likelihood,
      impact: Math.round(impact),
      status,
      description: raw.description ? String(raw.description).trim().slice(0, 4000) : null,
      created_at: now,
    })
  }

  // 3. Insert valid rows
  if (validToInsert.length > 0) {
    if (member && isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        if (!supabase) {
          return {
            ok: false,
            totalProcessed: items.length,
            importedCount: 0,
            skippedDuplicatesCount,
            invalidCount: invalidCount + validToInsert.length,
            importedRecords: [],
            errors: [{ row: 0, reason: "Database connection failed during batch insert." }],
          }
        }

        const rows = validToInsert.map((inc) => ({
          incident_id: inc.incident_id,
          incident_name: inc.incident_name,
          severity: inc.severity,
          risk_score: inc.risk_score,
          likelihood: inc.likelihood,
          impact: inc.impact,
          status: inc.status,
          description: inc.description,
          created_at: inc.created_at,
        }))

        const { error } = await supabase.from("incidents").insert(rows)
        if (error) {
          console.error("[IRM Action] Supabase batch import failed:", error.message)
          return {
            ok: false,
            totalProcessed: items.length,
            importedCount: 0,
            skippedDuplicatesCount,
            invalidCount: invalidCount + validToInsert.length,
            importedRecords: [],
            errors: [{ row: 0, reason: `Database batch insert failed: ${error.message}` }],
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[IRM Action] Supabase batch import error:", msg)
        return {
          ok: false,
          totalProcessed: items.length,
          importedCount: 0,
          skippedDuplicatesCount,
          invalidCount: invalidCount + validToInsert.length,
          importedRecords: [],
          errors: [{ row: 0, reason: `Database error: ${msg}` }],
        }
      }
    }

    memoryStore.addIncidents(validToInsert)
    revalidatePath("/incidents")
    revalidatePath("/")
    revalidatePath("/reports")
  }

  return {
    ok: validToInsert.length > 0 || (invalidCount === 0 && skippedDuplicatesCount === 0),
    totalProcessed: items.length,
    importedCount: validToInsert.length,
    skippedDuplicatesCount,
    invalidCount,
    importedRecords: validToInsert,
    errors,
  }
}
