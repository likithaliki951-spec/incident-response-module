"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { createIncident } from "@/app/actions"
import { classifyRisk } from "@/lib/irm"
import { SeverityBadge } from "@/components/badges"
import { Plus, X, Calculator } from "lucide-react"

export function AddIncidentForm() {
  const [open, setOpen] = useState(false)
  const [likelihood, setLikelihood] = useState(0.5)
  const [impact, setImpact] = useState(50)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const risk = Math.round(likelihood * impact)
  const severity = classifyRisk(risk)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createIncident(formData)
      if (result.ok) {
        setOpen(false)
        setLikelihood(0.5)
        setImpact(50)
      } else {
        setError(result.error)
      }
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Incident
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-base font-semibold">Report New Incident</h2>
            <p className="text-xs text-muted-foreground">The Arithmetic Unit computes risk from your inputs.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={onSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label htmlFor="incident_name" className="text-xs font-medium text-muted-foreground">
              Incident Name
            </label>
            <input
              id="incident_name"
              name="incident_name"
              required
              placeholder="e.g. Suspicious lateral movement detected"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Context, affected assets, detection source…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="likelihood" className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Likelihood</span>
                <span className="font-mono text-foreground">{likelihood.toFixed(2)}</span>
              </label>
              <input
                id="likelihood"
                name="likelihood"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={likelihood}
                onChange={(e) => setLikelihood(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <p className="text-[10px] text-muted-foreground">Probability (0–1)</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="impact" className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Impact</span>
                <span className="font-mono text-foreground">{impact}</span>
              </label>
              <input
                id="impact"
                name="impact"
                type="range"
                min={0}
                max={100}
                step={1}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <p className="text-[10px] text-muted-foreground">Severity of impact (0–100)</p>
            </div>
          </div>

          {/* AU live computation preview */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calculator className="h-4 w-4 text-chart-2" />
              <span className="font-mono">
                {likelihood.toFixed(2)} × {impact} =
              </span>
              <span className="font-mono text-lg font-semibold text-foreground">{risk}</span>
            </div>
            <SeverityBadge severity={severity} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Processing…" : "Submit to IRM"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
