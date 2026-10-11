"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { createIncident } from "@/app/actions"
import { classifyRisk, calculateRisk } from "@/lib/irm"
import { SeverityBadge } from "@/components/badges"
import { Plus, X, Calculator, ShieldPlus } from "lucide-react"

export function AddIncidentForm() {
  const [open, setOpen] = useState(false)
  const [likelihood, setLikelihood] = useState(0.75)
  const [impact, setImpact] = useState(80)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const { riskScore, severity } = calculateRisk(likelihood, impact)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      // Ensure the explicit state values are set in formData
      formData.set("likelihood", String(likelihood))
      formData.set("impact", String(impact))

      const result = await createIncident(formData)
      if (result.ok) {
        setOpen(false)
        setLikelihood(0.75)
        setImpact(80)
      } else {
        setError(result.error)
      }
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5 shadow-sm">
        <Plus className="h-4 w-4" />
        Add Incident
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setOpen(false)} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ShieldPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Report New Incident</h2>
              <p className="text-xs text-muted-foreground">The Arithmetic Unit (AU) computes risk from your inputs.</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={onSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label htmlFor="incident_name" className="text-xs font-medium text-muted-foreground">
              Incident Name <span className="text-red-400">*</span>
            </label>
            <input
              id="incident_name"
              name="incident_name"
              required
              placeholder="e.g. Unauthorized C2 Beaconing Detected"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
              Description & Context
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Affected hosts, IP addresses, detection telemetry source…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <label htmlFor="likelihood">Likelihood (0 - 1.0)</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={likelihood}
                  onChange={(e) => setLikelihood(Math.max(0, Math.min(1, Number(e.target.value))))}
                  className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-right font-mono text-xs text-foreground"
                />
              </div>
              <input
                id="likelihood"
                name="likelihood"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={likelihood}
                onChange={(e) => setLikelihood(Number(e.target.value))}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Probability of occurrence</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <label htmlFor="impact">Impact (0 - 100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={impact}
                  onChange={(e) => setImpact(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-right font-mono text-xs text-foreground"
                />
              </div>
              <input
                id="impact"
                name="impact"
                type="range"
                min={0}
                max={100}
                step={1}
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Potential operational impact</p>
            </div>
          </div>

          {/* AU Live Computation Preview */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calculator className="h-4 w-4 text-chart-2" />
              <span className="font-mono">
                AU: {likelihood.toFixed(2)} × {impact} =
              </span>
              <span className="font-mono text-lg font-bold text-foreground">{riskScore}</span>
            </div>
            <SeverityBadge severity={severity} />
          </div>

          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Processing AU Calculation…" : "Submit to IRM"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
