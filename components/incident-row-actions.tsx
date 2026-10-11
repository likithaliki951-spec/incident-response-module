"use client"

import { useState, useTransition } from "react"
import { updateIncidentStatus, deleteIncident } from "@/app/actions"
import { StatusBadge, SeverityBadge, RiskMeter } from "@/components/badges"
import { formatDateTime, type Incident, type IncidentStatus } from "@/lib/irm"
import { ChevronDown, Eye, Trash2, X, Calculator, ShieldAlert } from "lucide-react"

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
        className="flex items-center gap-1 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity"
        title="Click to change status"
      >
        <StatusBadge status={status} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => change(s)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-accent text-popover-foreground transition-colors"
              >
                <span>{s}</span>
                {s === status && <span className="text-primary font-bold">•</span>}
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

  const likelihood = incident.likelihood ?? (incident.risk_score / 100)
  const impact = incident.impact ?? 100

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="View incident details"
        title="View details"
      >
        <Eye className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                  {incident.incident_id}
                </span>
                <SeverityBadge severity={incident.severity} />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{incident.incident_name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Logged on {formatDateTime(incident.created_at)}
                </p>
              </div>

              {/* Arithmetic Unit Risk Calculation Display */}
              <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-chart-2">
                    <Calculator className="h-3.5 w-3.5" />
                    Arithmetic Unit (AU) Computation
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">Formula: L × I</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Likelihood (0-1)</p>
                    <p className="font-mono text-sm font-semibold">{likelihood.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Impact (0-100)</p>
                    <p className="font-mono text-sm font-semibold">{impact}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Risk Score (0-100)</p>
                    <p className="font-mono text-sm font-bold text-primary">{incident.risk_score}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Detail label="Status">
                  <StatusBadge status={incident.status} />
                </Detail>
                <Detail label="Risk Meter">
                  <RiskMeter score={incident.risk_score} />
                </Detail>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Incident Description & Telemetry
                </p>
                <div className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {incident.description || "No specific technical telemetry description provided for this incident."}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function DeleteIncidentButton({ id, incidentName }: { id: string; incidentName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    startTransition(async () => {
      await deleteIncident(id)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
        aria-label="Delete incident"
        title="Delete incident"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="font-semibold text-sm">Delete Incident Record?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove <span className="font-medium text-foreground">&quot;{incidentName}&quot;</span>? This will remove it from the pipeline metrics.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
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
