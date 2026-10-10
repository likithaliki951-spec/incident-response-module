import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SeverityBadge, StatusBadge, RiskMeter } from "@/components/badges"
import { RiskDistributionChart, ResponseTimelineChart } from "@/components/dashboard-charts"
import { SEVERITY_ORDER, timeAgo, type Incident, type Severity } from "@/lib/irm"
import { ShieldAlert, Flame, AlertOctagon, CheckCircle2, Activity, ArrowRight, Cpu, Boxes, MonitorDot } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data, error } = supabase
    ? await supabase.from("incidents").select("*").order("created_at", { ascending: false })
    : { data: null, error: null }

  const incidents = (data ?? []) as Incident[]

  const total = incidents.length
  const highRisk = incidents.filter((i) => i.risk_score >= 50).length
  const critical = incidents.filter((i) => i.severity === "Critical").length
  const resolved = incidents.filter((i) => i.status === "Resolved").length
  const openIncidents = incidents.filter((i) => i.status !== "Resolved")
  const overallRisk =
    openIncidents.length > 0
      ? Math.round(openIncidents.reduce((sum, i) => sum + i.risk_score, 0) / openIncidents.length)
      : 0

  const distribution = SEVERITY_ORDER.map((severity) => ({
    severity: severity as Severity,
    count: incidents.filter((i) => i.severity === severity).length,
  }))

  // Response timeline: incidents per day over the last 7 days
  const timeline = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - idx))
    const key = d.toISOString().slice(0, 10)
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      incidents: incidents.filter((i) => i.created_at.slice(0, 10) === key).length,
    }
  })

  const recent = incidents.slice(0, 6)

  const stats = [
    { label: "Total Incidents", value: total, icon: ShieldAlert, tone: "text-sky-400" },
    { label: "High-Risk", value: highRisk, icon: Flame, tone: "text-orange-400" },
    { label: "Critical", value: critical, icon: AlertOctagon, tone: "text-red-400" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, tone: "text-emerald-400" },
  ]

  const riskSeverity: Severity =
    overallRisk >= 80 ? "Critical" : overallRisk >= 50 ? "High" : overallRisk >= 20 ? "Medium" : "Low"

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Security Operations Dashboard"
        description="Real-time incident posture processed by the Incident Response Module."
      />

      {/* AU -> IRM -> GU pipeline banner */}
      <PipelineBanner overallRisk={overallRisk} />

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">
            Failed to load incidents from Supabase: {error.message}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="font-mono text-3xl font-semibold tabular-nums">{s.value}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Overall risk + charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Overall Risk Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-4">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.26 0.025 258)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={severityHex(riskSeverity)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallRisk / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-4xl font-bold tabular-nums">{overallRisk}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">of 100</span>
              </div>
            </div>
            <SeverityBadge severity={riskSeverity} />
            <p className="text-center text-xs text-muted-foreground">Mean risk across {openIncidents.length} active incidents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskDistributionChart data={distribution} />
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {distribution.map((d) => (
                <div key={d.severity} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: severityHex(d.severity) }} />
                  {d.severity} ({d.count})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponseTimelineChart data={timeline} />
            <p className="mt-2 text-center text-xs text-muted-foreground">Incidents ingested over the last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent incidents */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Incidents</CardTitle>
          <Link href="/incidents" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No incidents recorded yet.</p>
              <Link href="/incidents" className="text-xs text-primary hover:underline">
                Report the first incident
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">Incident</th>
                    <th className="pb-2 pr-4 font-medium">Severity</th>
                    <th className="pb-2 pr-4 font-medium">Risk</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((i) => (
                    <tr key={i.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{i.incident_id}</td>
                      <td className="py-3 pr-4 font-medium">{i.incident_name}</td>
                      <td className="py-3 pr-4"><SeverityBadge severity={i.severity} /></td>
                      <td className="py-3 pr-4"><RiskMeter score={i.risk_score} /></td>
                      <td className="py-3 pr-4"><StatusBadge status={i.status} /></td>
                      <td className="py-3 text-xs text-muted-foreground">{timeAgo(i.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function severityHex(severity: Severity): string {
  switch (severity) {
    case "Critical":
      return "#ef4444"
    case "High":
      return "#f97316"
    case "Medium":
      return "#f59e0b"
    case "Low":
      return "#10b981"
  }
}

function PipelineBanner({ overallRisk }: { overallRisk: number }) {
  const steps = [
    {
      icon: Cpu,
      key: "AU",
      title: "Arithmetic Unit",
      desc: "Risk = Likelihood × Impact",
      tone: "text-chart-2",
      ring: "ring-chart-2/30 bg-chart-2/10",
    },
    {
      icon: Boxes,
      key: "IRM",
      title: "Incident Response Module",
      desc: "Applies response rules & syncs",
      tone: "text-primary",
      ring: "ring-primary/30 bg-primary/10",
    },
    {
      icon: MonitorDot,
      key: "GU",
      title: "Graphical Unit",
      desc: "This dashboard",
      tone: "text-chart-3",
      ring: "ring-chart-3/30 bg-chart-3/10",
    },
  ]
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-stretch gap-3 p-4 md:flex-row md:items-center">
        {steps.map((step, idx) => {
          const Icon = step.icon
          return (
            <div key={step.key} className="flex flex-1 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${step.ring}`}>
                <Icon className={`h-5 w-5 ${step.tone}`} />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`font-mono ${step.tone}`}>{step.key}</span>
                  <span className="truncate text-muted-foreground">{step.title}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{step.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
