"use server"

import { revalidatePath } from "next/cache"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { memoryStore } from "@/lib/mock-data"
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

export async function createIncident(formData: FormData): Promise<ActionResult<Incident>> {
  const name = String(formData.get("incident_name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const likelihoodRaw = Number(formData.get("likelihood"))
  const impactRaw = Number(formData.get("impact"))

  if (!name) {
    return { ok: false, error: "Incident name is required." }
  }

  if (!Number.isFinite(likelihoodRaw) || likelihoodRaw < 0 || likelihoodRaw > 1) {
    return {
      ok: false,
      error: "Likelihood must be between 0.0 and 1.0.",
    }
  }

  if (!Number.isFinite(impactRaw) || impactRaw < 0 || impactRaw > 100) {
    return {
      ok: false,
      error: "Impact must be between 0 and 100.",
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
    impact: impactRaw,
    status: "Open" satisfies IncidentStatus,
    description: description || null,
    created_at: now,
  }

  // If Supabase is configured, persist to database
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase.from("incidents").insert({
          incident_id: incidentId,
          incident_name: name,
          severity,
          risk_score: riskScore,
          likelihood: likelihoodRaw,
          impact: impactRaw,
          status: "Open",
          description: description || null,
          created_at: now,
        })
        if (error) {
          console.warn("[IRM] Supabase insert warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase connection error during incident insert:", err)
    }
  }

  // Always update memory store for consistent immediate UI reflection
  memoryStore.addIncident(newIncident)

  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true, data: newIncident }
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
): Promise<ActionResult> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase
          .from("incidents")
          .update({ status })
          .or(`id.eq.${id},incident_id.eq.${id}`)
        if (error) {
          console.warn("[IRM] Supabase update warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase update error:", err)
    }
  }

  memoryStore.updateIncidentStatus(id, status)

  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true }
}

export async function deleteIncident(id: string): Promise<ActionResult> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase
          .from("incidents")
          .delete()
          .or(`id.eq.${id},incident_id.eq.${id}`)
        if (error) {
          console.warn("[IRM] Supabase delete warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase delete error:", err)
    }
  }

  memoryStore.deleteIncident(id)

  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")

  return { ok: true }
}

export async function recordMalwareTest(payload: {
  fileName: string
  fileSize: number
  sha256Hash: string
  detectionStatus: "Clean" | "Suspicious" | "Simulated Malicious" | "EICAR Standard Test"
  riskLevel: Severity | "Clean"
  scannerType: string
  scanNotes?: string
}): Promise<ActionResult<MalwareTest>> {
  const now = new Date().toISOString()
  const testRecord: MalwareTest = {
    id: `mlw-${Date.now()}`,
    file_name: payload.fileName,
    file_size: payload.fileSize,
    sha256_hash: payload.sha256Hash,
    detection_status: payload.detectionStatus,
    risk_level: payload.riskLevel,
    scanner_type: payload.scannerType,
    scan_notes: payload.scanNotes,
    created_at: now,
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase.from("malware_tests").insert({
          file_name: payload.fileName,
          file_size: payload.fileSize,
          sha256_hash: payload.sha256Hash,
          detection_status: payload.detectionStatus,
          risk_level: payload.riskLevel,
          scanner_type: payload.scannerType,
          scan_notes: payload.scanNotes,
          created_at: now,
        })
        if (error) {
          console.warn("[IRM] Supabase malware_tests insert warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase error recording malware test:", err)
    }
  }

  memoryStore.addMalwareTest(testRecord)

  revalidatePath("/malware")
  revalidatePath("/threats")

  return { ok: true, data: testRecord }
}

export async function toggleYaraRule(id: string, active: boolean): Promise<ActionResult> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase
          .from("yara_rules")
          .update({ is_active: active })
          .or(`id.eq.${id},rule_id.eq.${id}`)
        if (error) {
          console.warn("[IRM] Supabase yara_rules toggle warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase error toggling rule:", err)
    }
  }

  memoryStore.toggleYaraRule(id, active)
  revalidatePath("/rules")

  return { ok: true }
}

export async function createYaraRule(formData: FormData): Promise<ActionResult<YaraRule>> {
  const name = String(formData.get("rule_name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const severity = String(formData.get("severity") ?? "Medium") as Severity
  const ruleContent = String(formData.get("rule_content") ?? "").trim()

  if (!name) return { ok: false, error: "Rule name is required." }
  if (!ruleContent) return { ok: false, error: "YARA rule content/pattern is required." }

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

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
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
          console.warn("[IRM] Supabase yara insert warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase error adding YARA rule:", err)
    }
  }

  memoryStore.addYaraRule(newRule)
  revalidatePath("/rules")

  return { ok: true, data: newRule }
}

export async function createIncidentReport(payload: {
  incidentId: string
  reportTitle: string
  riskScore: number
  severity: Severity
  analysisResult: string
  responseNotes: string
  generatedBy?: string
}): Promise<ActionResult<IncidentReport>> {
  const now = new Date().toISOString()
  const report: IncidentReport = {
    id: `rep-${Date.now()}`,
    incident_id: payload.incidentId,
    report_title: payload.reportTitle,
    risk_score: payload.riskScore,
    severity: payload.severity,
    analysis_result: payload.analysisResult,
    response_notes: payload.responseNotes,
    generated_by: payload.generatedBy || "Security Responder",
    created_at: now,
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { error } = await supabase.from("reports").insert({
          incident_id: payload.incidentId,
          report_title: payload.reportTitle,
          risk_score: payload.riskScore,
          severity: payload.severity,
          analysis_result: payload.analysisResult,
          response_notes: payload.responseNotes,
          generated_by: payload.generatedBy || "Security Responder",
          created_at: now,
        })
        if (error) {
          console.warn("[IRM] Supabase report insert warning:", error.message)
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Supabase error saving report:", err)
    }
  }

  memoryStore.addReport(report)
  revalidatePath("/reports")

  return { ok: true, data: report }
}

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
  const errors: { row: number; identifier?: string; reason: string }[] = []
  const validToInsert: Incident[] = []
  let skippedDuplicatesCount = 0
  let invalidCount = 0

  // 1. Fetch existing incident IDs to prevent collisions
  const existingIdSet = new Set<string>()
  if (isSupabaseConfigured()) {
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

  // Also include in-memory existing incidents
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
    if (!name) {
      invalidCount++
      errors.push({
        row: rowNum,
        identifier: raw.incident_id || `Row #${rowNum}`,
        reason: "Missing required 'incident_name'",
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
      // Auto-generate unique ID
      incId = `INC-${Date.now().toString().slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`
      batchIdSet.add(incId.toUpperCase())
    }

    // AU Formula: Risk = Likelihood × Impact (0 - 100)
    const { riskScore, severity } = calculateRisk(likelihood, impact)

    // Append source to description if present
    let desc = String(raw.description ?? "").trim()
    if (raw.source && raw.source.trim()) {
      desc = desc ? `${desc} [Source: ${raw.source.trim()}]` : `[Source: ${raw.source.trim()}]`
    }

    const newIncident: Incident = {
      id: `inc-${Date.now()}-${idx}`,
      incident_id: incId,
      incident_name: name,
      severity,
      risk_score: riskScore,
      likelihood,
      impact: Math.round(impact),
      status,
      description: desc || null,
      created_at: new Date(Date.now() - idx * 1000).toISOString(),
    }

    validToInsert.push(newIncident)
  }

  // 3. Save valid records
  if (validToInsert.length > 0) {
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        if (supabase) {
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
            console.warn("[IRM] Supabase batch import warning:", error.message)
          }
        }
      } catch (err: unknown) {
        console.warn("[IRM] Supabase batch import error:", err)
      }
    }

    // Always update local memory store
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

