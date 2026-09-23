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

// The AU calculates Risk = Likelihood x Impact (0-100).
// The IRM classifies that risk score into a severity using the response rules below.
export function classifyRisk(risk: number): Severity {
  if (risk >= 80) return "Critical"
  if (risk >= 50) return "High"
  if (risk >= 20) return "Medium"
  return "Low"
}

export const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"]

export function severityStyles(severity: Severity): { badge: string; dot: string; text: string; hex: string } {
  switch (severity) {
    case "Critical":
      return {
        badge: "border-red-500/30 bg-red-500/10 text-red-400",
        dot: "bg-red-500",
        text: "text-red-400",
        hex: "#ef4444",
      }
    case "High":
      return {
        badge: "border-orange-500/30 bg-orange-500/10 text-orange-400",
        dot: "bg-orange-500",
        text: "text-orange-400",
        hex: "#f97316",
      }
    case "Medium":
      return {
        badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        dot: "bg-amber-500",
        text: "text-amber-400",
        hex: "#f59e0b",
      }
    case "Low":
      return {
        badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        dot: "bg-emerald-500",
        text: "text-emerald-400",
        hex: "#10b981",
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
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
