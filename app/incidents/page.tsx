import { fetchIncidents } from "@/lib/data-service"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { AddIncidentForm } from "@/components/add-incident-form"
import { ImportIncidentsModal } from "@/components/import-incidents-modal"
import { IncidentsTable } from "@/components/incidents-table"
import { Database } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function IncidentsPage() {
  const { data: incidents, isSupabase, error } = await fetchIncidents()

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Incident Management"
        description="Track, triage, and resolve security events processed by the Incident Response Module (IRM)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <ImportIncidentsModal existingIncidents={incidents} />
          <AddIncidentForm />
        </div>
      </PageHeader>

      {/* Database connection status notice */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Storage Backend:</span>
          {isSupabase ? (
            <span className="text-emerald-400 font-medium">Supabase Cloud Database (Live Sync)</span>
          ) : (
            <span className="text-muted-foreground">
              Local Prototype Store (Ready for Supabase credentials in .env.local)
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {incidents.length} total incidents
        </span>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">
            Database notice: {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <IncidentsTable incidents={incidents} />
        </CardContent>
      </Card>
    </div>
  )
}
