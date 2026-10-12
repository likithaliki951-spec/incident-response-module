import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { memoryStore } from "@/lib/mock-data"
import { getCurrentTeamMember } from "@/lib/auth"
import {
  calculateRisk,
  classifyRisk,
  type Incident,
  type MalwareTest,
  type YaraRule,
  type IncidentReport,
  type Threat,
  type ResponseRule,
  type Severity,
} from "@/lib/irm"

export interface DataFetchResult<T> {
  data: T
  isSupabase: boolean
  error?: string | null
}

export async function fetchIncidents(): Promise<DataFetchResult<Incident[]>> {
  const teamMember = await getCurrentTeamMember()

  // 1. Authenticated Team Member: Access Live Supabase Cloud Database
  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[IRM] Supabase incidents query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedIncidents: Incident[] = (data || []).map((row: Record<string, unknown>) => {
          const likelihood = Number(row.likelihood ?? 0.5)
          const impact = Math.round(Number(row.impact ?? 50))
          const riskScore = Number(row.risk_score ?? calculateRisk(likelihood, impact).riskScore)
          const severity = (row.severity || classifyRisk(riskScore)) as Severity

          return {
            id: String(row.id || ""),
            incident_id: String(row.incident_id || row.id || `INC-${Date.now()}`),
            incident_name: String(row.incident_name || row.title || "Unnamed Incident"),
            severity,
            risk_score: riskScore,
            likelihood,
            impact,
            status: (row.status || "Open") as Incident["status"],
            description: row.description ? String(row.description) : null,
            created_at: String(row.created_at || new Date().toISOString()),
          }
        })

        return { data: mappedIncidents, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Supabase incidents connection error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  // 2. Unauthenticated / Demo Mode: Serve isolated local in-memory store
  return { data: memoryStore.getIncidents(), isSupabase: false }
}

export async function fetchMalwareTests(): Promise<DataFetchResult<MalwareTest[]>> {
  const teamMember = await getCurrentTeamMember()

  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("malware_tests")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[IRM] Supabase malware_tests query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedTests: MalwareTest[] = (data || []).map((row: Record<string, unknown>) => {
          // Honest representation: never report missing scan results as Clean or Low
          const rawDetection = row.detection_status || row.detection_result
          const detectionStatus = (rawDetection ? String(rawDetection) : "Unknown") as MalwareTest["detection_status"]

          const rawRisk = row.risk_level || row.severity
          const riskLevel = (rawRisk ? String(rawRisk) : "Unknown") as MalwareTest["risk_level"]

          return {
            id: String(row.id ?? ""),
            file_name: String(row.file_name || row.filename || "unknown_sample"),
            file_size: Number(row.file_size || row.filesize || 0),
            sha256_hash: String(row.sha256_hash || row.file_hash || row.hash || "Unknown"),
            detection_status: detectionStatus,
            risk_level: riskLevel,
            scanner_type: String(row.scanner_type || row.scanner || "Static Triage Scanner"),
            scan_notes: row.scan_notes ? String(row.scan_notes) : (row.notes ? String(row.notes) : undefined),
            created_at: String(row.created_at || row.tested_at || new Date().toISOString()),
          }
        })

        return { data: mappedTests, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Malware tests query error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  return { data: memoryStore.getMalwareTests(), isSupabase: false }
}

export async function fetchYaraRules(): Promise<DataFetchResult<YaraRule[]>> {
  const teamMember = await getCurrentTeamMember()

  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("yara_rules")
          .select("*")
          .order("id", { ascending: true })

        if (error) {
          console.error("[IRM] Supabase yara_rules query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedRules: YaraRule[] = (data || []).map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          rule_id: String(row.rule_id || `YARA-${String(row.id).padStart(3, "0")}`),
          rule_name: String(row.rule_name || "Custom Rule"),
          description: String(row.description || ""),
          severity: (row.severity || "Medium") as Severity,
          rule_content: String(row.rule_content || ""),
          is_active: Boolean(row.is_active ?? true),
          created_at: row.created_at ? String(row.created_at) : undefined,
        }))

        return { data: mappedRules, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Yara rules query error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  return { data: memoryStore.getYaraRules(), isSupabase: false }
}

export async function fetchReports(): Promise<DataFetchResult<IncidentReport[]>> {
  const teamMember = await getCurrentTeamMember()

  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[IRM] Supabase reports query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedReports: IncidentReport[] = (data || []).map((row: Record<string, unknown>) => {
          // Keep report_id separate from incident_id; never use a report identifier as an incident identifier
          const reportId = row.report_id ? String(row.report_id) : (row.id ? `REP-${row.id}` : undefined)
          const incidentId = row.incident_id ? String(row.incident_id) : "Unassigned"

          return {
            id: String(row.id ?? row.report_id ?? ""),
            report_id: reportId,
            incident_id: incidentId,
            report_title: String(row.report_title || (incidentId !== "Unassigned" ? `Report for ${incidentId}` : `Incident Report ${reportId || ""}`)),
            risk_score: Number(row.risk_score ?? 0),
            severity: (row.severity || "Medium") as Severity,
            // Do not invent completed analysis results for missing fields
            analysis_result: String(row.analysis_result || row.report_content || "No analysis recorded"),
            response_notes: String(row.response_notes || "No remediation notes recorded"),
            generated_by: row.generated_by ? String(row.generated_by) : "SecOps Analyst",
            created_at: String(row.created_at || new Date().toISOString()),
          }
        })

        return { data: mappedReports, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Reports query error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  return { data: memoryStore.getReports(), isSupabase: false }
}

export async function fetchThreats(): Promise<DataFetchResult<Threat[]>> {
  const teamMember = await getCurrentTeamMember()

  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("threats")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[IRM] Supabase threats query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedThreats: Threat[] = (data || []).map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          threat_name: String(row.threat_name || "Unknown Threat"),
          threat_type: String(row.threat_type || "External Telemetry"),
          risk_level: (row.risk_level || row.severity || "Medium") as Severity,
          source: String(row.source || "External Feed"),
          status: String(row.status || "Active"),
          created_at: String(row.created_at || new Date().toISOString()),
        }))

        return { data: mappedThreats, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Threats query error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  return { data: memoryStore.getThreats(), isSupabase: false }
}

export async function fetchResponseRules(): Promise<DataFetchResult<ResponseRule[]>> {
  const teamMember = await getCurrentTeamMember()

  if (teamMember && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("response_rules")
          .select("*")
          .order("id", { ascending: true })

        if (error) {
          console.error("[IRM] Supabase response_rules query failed:", error.message)
          return { data: [], isSupabase: true, error: error.message }
        }

        const mappedRules: ResponseRule[] = (data || []).map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          rule_id: String(row.rule_id || `RULE-${row.id}`),
          rule_name: String(row.rule_name || "AU Response Policy"),
          condition: String(row.condition || row.condition_query || "True"),
          severity: (row.severity || "Medium") as Severity,
          is_active: Boolean(row.is_active ?? (row.status === "Active")),
        }))

        return { data: mappedRules, isSupabase: true }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[IRM] Response rules query error:", message)
      return { data: [], isSupabase: true, error: message }
    }
  }

  return { data: memoryStore.getResponseRules(), isSupabase: false }
}
