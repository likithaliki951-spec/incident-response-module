import { redirect } from "next/navigation"
import { getCurrentTeamMember } from "@/lib/auth"
import { fetchIncidents, fetchReports } from "@/lib/data-service"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SeverityBarChart, TrendLineChart } from "@/components/report-charts"
import { ReportGenerator } from "@/components/report-generator"
import { SEVERITY_ORDER, severityStyles, type Incident, type Severity } from "@/lib/irm"
import { FileBarChart, TrendingUp, Clock, ShieldCheck, Database } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const user = await getCurrentTeamMember()

  const [incidentsResult, reportsResult] = await Promise.all([
    fetchIncidents(),
    fetchReports(),
  ])

  const incidents = incidentsResult.data
  const reports = reportsResult.data

  const total = incidents.length
  const resolved = incidents.filter((i) => i.status === "Resolved").length
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0
  const avgRisk = total > 0 ? Math.round(incidents.reduce((s, i) => s + i.risk_score, 0) / total) : 0

  const severityData = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: incidents.filter((i) => i.severity === severity).length,
    hex: severityStyles(severity as Severity).hex,
  }))

  // 7-day average-risk trend
  const trend = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - idx))
    const key = d.toISOString().slice(0, 10)
    const dayIncidents = incidents.filter((i) => i.created_at.slice(0, 10) === key)
    const risk =
      dayIncidents.length > 0
        ? Math.round(dayIncidents.reduce((s, i) => s + i.risk_score, 0) / dayIncidents.length)
        : 0
    return { day: d.toLocaleDateString("en-US", { weekday: "short" }), risk }
  })

  const summary = [
    { label: "Total Processed", value: String(total), icon: FileBarChart, tone: "text-sky-400" },
    { label: "Avg AU Risk Score", value: String(avgRisk), icon: TrendingUp, tone: "text-orange-400" },
    { label: "Resolution Rate", value: `${resolutionRate}%`, icon: ShieldCheck, tone: "text-emerald-400" },
    { label: "Open IRM Cases", value: String(total - resolved), icon: Clock, tone: "text-amber-400" },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Reports & Analytics"
        description="Aggregated incident telemetry rendered by the Graphical Unit (GU) and downloadable forensic HTML reports."
      />

      {/* Database connection notice */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Storage Backend:</span>
          {reportsResult.isSupabase ? (
            <span className="text-emerald-400 font-medium">Supabase Cloud Database (Live Sync)</span>
          ) : (
            <span className="text-muted-foreground">
              Local Prototype Store (Synchronized in-memory)
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {reports.length} reports generated
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => {
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

      {/* Standalone HTML Report Generator (Module 5) */}
      <ReportGenerator incidents={incidents} initialReports={reports} />

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidents by Severity</CardTitle>
            <CardDescription>Volume distribution classified by the IRM</CardDescription>
          </CardHeader>
          <CardContent>
            <SeverityBarChart data={severityData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Risk Score Trend</CardTitle>
            <CardDescription>Arithmetic Unit mean score per day over the last week</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Severity Breakdown</CardTitle>
          <CardDescription>Counts and share of total volume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {severityData.map((s) => {
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
              return (
                <div key={s.severity} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium text-muted-foreground">{s.severity}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.hex }} />
                  </div>
                  <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {s.count} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
