import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentTeamMember } from "@/lib/auth"
import { fetchThreats } from "@/lib/data-service"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { SeverityBadge, StatusBadge } from "@/components/badges"
import { formatDateTime, type Threat, type Severity } from "@/lib/irm"
import { Radar, Bug, ArrowRight, Database } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ThreatsPage() {
  const user = await getCurrentTeamMember()

  const { data: threats, isSupabase, error } = await fetchThreats()

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Threat Intelligence Feed"
        description="External threat intelligence feeds and telemetry ingested by the IRM for risk contextualization."
      >
        <Link
          href="/malware"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Bug className="h-3.5 w-3.5 text-primary" />
          Malware Triage Scanner
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
        </Link>
      </PageHeader>

      {/* Backend status */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Storage Backend:</span>
          {isSupabase ? (
            <span className="text-emerald-400 font-medium">Supabase &apos;threats&apos; (Live Sync)</span>
          ) : (
            <span className="text-muted-foreground">
              Local Prototype Store (Synchronized in-memory)
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {threats.length} threat intelligence feeds active
        </span>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">Failed to load threats: {error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {threats.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted/60 p-4">
                <Radar className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium">No threat intelligence feeds configured.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Threat Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Risk Level</th>
                    <th className="px-4 py-3 font-medium">Advisory Source</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Ingested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {threats.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{t.threat_name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {t.threat_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={t.risk_level as Severity} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.source}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
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
