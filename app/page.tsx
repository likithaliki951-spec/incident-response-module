import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentTeamMember } from "@/lib/auth"
import { fetchIncidents } from "@/lib/data-service"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SeverityBadge, StatusBadge, RiskMeter } from "@/components/badges"
import { RiskDistributionChart, ResponseTimelineChart } from "@/components/dashboard-charts"
import { AddIncidentForm } from "@/components/add-incident-form"
import { SEVERITY_ORDER, timeAgo, type Incident, type Severity } from "@/lib/irm"
import {
  ShieldAlert,
  Flame,
  AlertOctagon,
  CheckCircle2,
  Activity,
  ArrowRight,
  Cpu,
  Boxes,
  MonitorDot,
  Clock,
  Database,
  Bug,
  FileBarChart,
  FileCode2,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await getCurrentTeamMember()

  const { data: incidents, isSupabase, error } = await fetchIncidents()

  const total = incidents.length
  const openIncidents = incidents.filter((i) => i.status !== "Resolved")
  const openCount = openIncidents.length
  const highRisk = incidents.filter((i) => i.risk_score >= 50).length
  const critical = incidents.filter((i) => i.severity === "Critical").length
  const resolved = incidents.filter((i) => i.status === "Resolved").length
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

  // 5 counts required by prompt: Total, Open, High-Risk, Critical, Resolved
  const stats = [
    { label: "Total Incidents", value: total, icon: ShieldAlert, tone: "text-sky-400", desc: "All recorded cases" },
    { label: "Open / Active", value: openCount, icon: Clock, tone: "text-violet-400", desc: "Awaiting resolution" },
    { label: "High-Risk", value: highRisk, icon: Flame, tone: "text-orange-400", desc: "Risk score ≥ 50" },
    { label: "Critical", value: critical, icon: AlertOctagon, tone: "text-red-400", desc: "Risk score ≥ 80" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, tone: "text-emerald-400", desc: "Successfully closed" },
  ]

  const riskSeverity: Severity =
    overallRisk >= 80 ? "Critical" : overallRisk >= 50 ? "High" : overallRisk >= 20 ? "Medium" : "Low"

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Security Operations Dashboard"
        description="Real-time incident posture processed by the Arithmetic Unit (AU) and Incident Response Module (IRM)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/malware"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Bug className="h-3.5 w-3.5 text-primary" />
            Malware Analysis
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <FileBarChart className="h-3.5 w-3.5 text-chart-3" />
            Generate Report
          </Link>
          <AddIncidentForm />
        </div>
      </PageHeader>

      {/* Mode and Database Status Banner */}
      {!user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
            <div>
              <span className="font-semibold text-amber-300">Interactive Demo Mode:</span>{" "}
              <span>Viewing simulated incident telemetry. Actions are evaluated locally and isolated from the database.</span>
            </div>
          </div>
          <Link
            href="/login"
            className="self-start sm:self-auto rounded bg-amber-500/20 px-3 py-1 font-medium text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors whitespace-nowrap"
          >
            Team Sign In
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Storage Backend:</span>
            {isSupabase ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Supabase Cloud Database (Live Cloud Sync) · Signed in as {user.name} ({user.role})
              </span>
            ) : (
              <span className="text-muted-foreground">
                Local Prototype Store (Synchronized in-memory)
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {incidents.length} incident records loaded
          </span>
        </div>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">
            Database notice: {error}
          </CardContent>
        </Card>
      )}

      {/* AU -> IRM -> GU pipeline visualization */}
      <PipelineBanner overallRisk={overallRisk} openCount={openCount} />

      {/* 5 Stat cards: Total, Open, High-Risk, Critical, Resolved */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <div className="rounded-md bg-muted/60 p-1.5">
                    <Icon className={`h-4 w-4 ${s.tone}`} />
                  </div>
                </div>
                <div>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Overall risk + charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Mean Risk Gauge */}
        <Card>
          <CardHeader>
            <CardTitle>Mean Risk Score</CardTitle>
            <CardDescription>Arithmetic Unit average across active incidents</CardDescription>
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
            <div className="text-center text-xs text-muted-foreground space-y-0.5">
              <p>Formula: <span className="font-mono text-foreground font-medium">Risk = Likelihood × Impact</span></p>
              <p>{openIncidents.length} active incidents evaluated</p>
            </div>
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Breakdown by IRM severity classification</CardDescription>
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

        {/* Response Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Response Timeline</CardTitle>
            <CardDescription>Incidents ingested over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponseTimelineChart data={timeline} />
            <p className="mt-2 text-center text-xs text-muted-foreground">Synchronized by IRM ingestion pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent incidents */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Incidents</CardTitle>
            <CardDescription>Latest events triaged through the AU → IRM → GU pipeline</CardDescription>
          </div>
          <Link
            href="/incidents"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Manage all ({total}) <ArrowRight className="h-3 w-3" />
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
                    <th className="pb-3 pr-4 font-medium">Incident ID</th>
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Severity</th>
                    <th className="pb-3 pr-4 font-medium">AU Risk Score</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recent.map((i) => (
                    <tr key={i.id} className="transition-colors hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        <Link href="/incidents" className="hover:text-primary hover:underline">
                          {i.incident_id}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        <Link href="/incidents" className="hover:underline">
                          {i.incident_name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <SeverityBadge severity={i.severity} />
                      </td>
                      <td className="py-3 pr-4">
                        <RiskMeter score={i.risk_score} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={i.status} />
                      </td>
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

function PipelineBanner({ overallRisk, openCount }: { overallRisk: number; openCount: number }) {
  const steps = [
    {
      icon: Cpu,
      key: "AU",
      title: "Arithmetic Unit",
      desc: "Computes Risk = Likelihood × Impact (0–100)",
      detail: `Current Mean Score: ${overallRisk}/100`,
      tone: "text-chart-2",
      ring: "ring-chart-2/30 bg-chart-2/10",
    },
    {
      icon: Boxes,
      key: "IRM",
      title: "Incident Response Module",
      desc: "Applies response policies & syncs DB",
      detail: `${openCount} active cases in queue`,
      tone: "text-primary",
      ring: "ring-primary/30 bg-primary/10",
    },
    {
      icon: MonitorDot,
      key: "GU",
      title: "Graphical Unit",
      desc: "Renders SOC dashboard & reports",
      detail: "Live telemetry operational",
      tone: "text-chart-3",
      ring: "ring-chart-3/30 bg-chart-3/10",
    },
  ]
  return (
    <Card className="overflow-hidden border-primary/20 bg-card/80">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="font-mono text-primary">AU → IRM → GU</span>
            <span>Architecture Data Pipeline</span>
          </CardTitle>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            Pipeline Synchronized
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-stretch gap-3 p-4 pt-0 md:flex-row md:items-center">
        {steps.map((step, idx) => {
          const Icon = step.icon
          return (
            <div key={step.key} className="flex flex-1 items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${step.ring}`}>
                <Icon className={`h-5 w-5 ${step.tone}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className={`font-mono ${step.tone}`}>{step.key}</span>
                  <span className="truncate text-foreground">{step.title}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{step.desc}</p>
                <p className="font-mono text-[10px] text-muted-foreground/80 mt-0.5">{step.detail}</p>
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
