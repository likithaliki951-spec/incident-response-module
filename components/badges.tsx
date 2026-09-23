import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { severityStyles, statusStyles, type Severity } from "@/lib/irm"

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = severityStyles(severity)
  return (
    <Badge className={s.badge}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {severity}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusStyles(status)}>{status}</Badge>
}

export function RiskMeter({ score }: { score: number }) {
  const severity: Severity = score >= 80 ? "Critical" : score >= 50 ? "High" : score >= 20 ? "Medium" : "Low"
  const s = severityStyles(severity)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", s.dot)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={cn("font-mono text-xs font-semibold tabular-nums", s.text)}>{score}</span>
    </div>
  )
}
