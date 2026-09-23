"use client"

import { useState, useTransition } from "react"
import { updateIncidentStatus } from "@/app/actions"
import { StatusBadge, SeverityBadge, RiskMeter } from "@/components/badges"
import { formatDateTime, type Incident, type IncidentStatus } from "@/lib/irm"
import { ChevronDown, Eye, X } from "lucide-react"

const STATUSES: IncidentStatus[] = ["Open", "Investigating", "Resolved"]

export function StatusControl({ id, status }: { id: string; status: IncidentStatus }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function change(next: IncidentStatus) {
    setOpen(false)
    if (next === status) return
    startTransition(async () => {
      await updateIncidentStatus(id, next)
    })
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1 rounded-md hover:opacity-80 disabled:opacity-50"
      >
        <StatusBadge status={status} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => change(s)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-accent"
              >
                {s}
                {s === status && <span className="text-primary">•</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ViewIncidentButton({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="View details"
      >
        <Eye className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{incident.incident_id}</span>
                <SeverityBadge severity={incident.severity} />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <h2 className="text-lg font-semibold">{incident.incident_name}</h2>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Risk Score">
                  <RiskMeter score={incident.risk_score} />
                </Detail>
                <Detail label="Status">
                  <StatusBadge status={incident.status} />
                </Detail>
                <Detail label="Reported">
                  <span className="text-sm">{formatDateTime(incident.created_at)}</span>
                </Detail>
                <Detail label="Severity">
                  <SeverityBadge severity={incident.severity} />
                </Detail>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {incident.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
