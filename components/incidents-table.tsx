"use client"

import { useState } from "react"
import { SeverityBadge, RiskMeter, StatusBadge } from "@/components/badges"
import { StatusControl, ViewIncidentButton, DeleteIncidentButton } from "@/components/incident-row-actions"
import { formatDateTime, type Incident, type Severity, type IncidentStatus } from "@/lib/irm"
import { Search, Filter, ShieldAlert } from "lucide-react"

export function IncidentsTable({ incidents }: { incidents: Incident[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [severityFilter, setSeverityFilter] = useState<string>("ALL")

  const filtered = incidents.filter((item) => {
    const matchesSearch =
      search.trim() === "" ||
      item.incident_name.toLowerCase().includes(search.toLowerCase()) ||
      item.incident_id.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))

    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter
    const matchesSeverity = severityFilter === "ALL" || item.severity === severityFilter

    return matchesSearch && matchesStatus && matchesSeverity
  })

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, title, or keywords…"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Investigating">Investigating</option>
            <option value="Resolved">Resolved</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span>Severity:</span>
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-medium">No matching incidents found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {incidents.length === 0
                ? "Click 'Add Incident' to report a new security event."
                : "Try adjusting your search criteria or filter selections."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Incident ID</th>
                <th className="px-4 py-3 font-medium">Incident Name</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">AU Risk (L × I)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Logged Time</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {incident.incident_id}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                    {incident.incident_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <RiskMeter score={incident.risk_score} />
                      {incident.likelihood !== undefined && incident.impact !== undefined && (
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {incident.likelihood.toFixed(2)} × {incident.impact}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusControl id={incident.id} status={incident.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(incident.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <ViewIncidentButton incident={incident} />
                      <DeleteIncidentButton id={incident.id} incidentName={incident.incident_name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
