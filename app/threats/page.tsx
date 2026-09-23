import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { SeverityBadge, StatusBadge } from "@/components/badges"
import { formatDateTime, type Threat } from "@/lib/irm"
import { Radar } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ThreatsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("threats")
    .select("*")
    .order("created_at", { ascending: false })

  const threats = (data ?? []) as Threat[]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Threat Data"
        description="Threat intelligence feeds ingested by the Arithmetic Unit for risk scoring."
      />

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">Failed to load threats: {error.message}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {threats.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted/60 p-4">
                <Radar className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium">No threat intelligence available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Threat Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Risk Level</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {threats.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{t.threat_name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {t.threat_type}
                        </span>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={t.risk_level} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.source}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
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
