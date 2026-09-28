import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { SeverityBadge, RiskMeter } from "@/components/badges"
import { AddIncidentForm } from "@/components/add-incident-form"
import {
StatusControl,
ViewIncidentButton,
} from "@/components/incident-row-actions"
import { formatDateTime, type Incident } from "@/lib/irm"
import { ShieldAlert } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function IncidentsPage() {
const supabase = await createClient()

const { data, error } = await supabase
.from("incidents")
.select("*")
.order("created_at", { ascending: false })


const incidents = (data ?? []) as Incident[]

return ( <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8"> <PageHeader
     title="Incident Management"
     description="Track, triage, and resolve incidents processed by the IRM."
   > <AddIncidentForm /> </PageHeader>

```
  {error && (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardContent className="p-4 text-sm text-red-400">
        Failed to load incidents: {error.message}
      </CardContent>
    </Card>
  )}

  <Card>
    <CardContent className="p-0">
      {incidents.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/60" />
          </div>

          <div>
            <p className="text-sm font-medium">
              No incidents yet
            </p>

            <p className="text-xs text-muted-foreground">
              Use “Add Incident” to submit one through the IRM.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  Incident ID
                </th>

                <th className="px-4 py-3 font-medium">
                  Name
                </th>

                <th className="px-4 py-3 font-medium">
                  Severity
                </th>

                <th className="px-4 py-3 font-medium">
                  Risk Score
                </th>

                <th className="px-4 py-3 font-medium">
                  Status
                </th>

                <th className="px-4 py-3 font-medium">
                  Timestamp
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Details
                </th>
              </tr>
            </thead>

            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {incident.incident_id}
                  </td>

                  <td className="px-4 py-3 font-medium">
                    {incident.incident_name}
                  </td>

                  <td className="px-4 py-3">
                    <SeverityBadge severity={incident.severity} />
                  </td>

                  <td className="px-4 py-3">
                    <RiskMeter score={incident.risk_score} />
                  </td>

                  <td className="px-4 py-3">
                    <StatusControl
                      id={incident.id}
                      status={incident.status}
                    />
                  </td>

                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(incident.created_at)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <ViewIncidentButton incident={incident} />
                  </td>
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
