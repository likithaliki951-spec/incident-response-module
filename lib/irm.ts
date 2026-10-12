// Incident Response Module (IRM) shared domain logic.
// Architecture: Arithmetic Unit (AU) -> Incident Response Module (IRM) -> Graphical Unit (GU)

export type Severity = "Critical" | "High" | "Medium" | "Low"
export type IncidentStatus = "Open" | "Investigating" | "Resolved"

export interface Incident {
  id: string
  incident_id: string
  incident_name: string
  severity: Severity
  risk_score: number
  likelihood?: number
  impact?: number
  status: IncidentStatus
  description: string | null
  created_at: string
}

export interface Threat {
  id: string
  threat_name: string
  threat_type: string
  risk_level: Severity
  source: string
  status: string
  created_at: string
}

export interface ResponseRule {
  id: string
  rule_id: string
  rule_name: string
  condition: string
  severity: Severity
  is_active: boolean
}

export interface MalwareTest {
  id: string
  file_name: string
  file_size: number
  sha256_hash: string
  detection_status: "Clean" | "Suspicious" | "Simulated Malicious" | "EICAR Standard Test" | "Unknown"
  risk_level: Severity | "Clean" | "Unknown"
  scanner_type: string
  scan_notes?: string
  created_at: string
}

export interface YaraRule {
  id: string
  rule_id: string
  rule_name: string
  description: string
  severity: Severity
  rule_content: string
  is_active: boolean
  created_at?: string
}

export interface IncidentReport {
  id: string
  report_id?: string
  incident_id: string
  report_title: string
  risk_score: number
  severity: Severity
  analysis_result: string
  response_notes: string
  generated_by?: string
  created_at: string
}

// Arithmetic Unit (AU): Risk = Likelihood × Impact (0 - 100)
// Likelihood: 0.00 to 1.00
// Impact: 0 to 100
export function calculateRisk(likelihood: number, impact: number): { riskScore: number; severity: Severity } {
  const clampedLikelihood = Math.max(0, Math.min(1, Number(likelihood) || 0))
  const clampedImpact = Math.max(0, Math.min(100, Number(impact) || 0))
  const riskScore = Math.round(clampedLikelihood * clampedImpact)
  return {
    riskScore,
    severity: classifyRisk(riskScore),
  }
}

// The IRM classifies the calculated risk score into an operational severity category
export function classifyRisk(risk: number): Severity {
  if (risk >= 80) return "Critical"
  if (risk >= 50) return "High"
  if (risk >= 20) return "Medium"
  return "Low"
}

export const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"]

export function severityStyles(severity: Severity | "Unknown" | "Clean"): {
  badge: string
  dot: string
  text: string
  hex: string
  soft: string
} {
  switch (severity) {
    case "Critical":
      return {
        badge: "border-red-500/30 bg-red-500/10 text-red-400",
        dot: "bg-red-500",
        text: "text-red-400",
        hex: "#ef4444",
        soft: "bg-red-500/10 text-red-400 border border-red-500/20",
      }
    case "High":
      return {
        badge: "border-orange-500/30 bg-orange-500/10 text-orange-400",
        dot: "bg-orange-500",
        text: "text-orange-400",
        hex: "#f97316",
        soft: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
      }
    case "Medium":
      return {
        badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        dot: "bg-amber-500",
        text: "text-amber-400",
        hex: "#f59e0b",
        soft: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      }
    case "Low":
    case "Clean":
      return {
        badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        dot: "bg-emerald-500",
        text: "text-emerald-400",
        hex: "#10b981",
        soft: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      }
    case "Unknown":
    default:
      return {
        badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
        dot: "bg-zinc-500",
        text: "text-zinc-400",
        hex: "#71717a",
        soft: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
      }
  }
}

export function statusStyles(status: string): string {
  switch (status) {
    case "Open":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400"
    case "Investigating":
      return "border-violet-500/30 bg-violet-500/10 text-violet-400"
    case "Resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    case "Active":
      return "border-red-500/30 bg-red-500/10 text-red-400"
    case "Mitigated":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    case "Monitoring":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400"
    case "Clean":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    case "Suspicious":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400"
    case "Simulated Malicious":
    case "EICAR Standard Test":
      return "border-red-500/30 bg-red-500/10 text-red-400"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return "Recently"
  }
}

// Safely escape user strings for HTML rendering
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
