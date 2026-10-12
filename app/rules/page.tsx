import { redirect } from "next/navigation"
import { getCurrentTeamMember } from "@/lib/auth"
import { fetchYaraRules, fetchResponseRules } from "@/lib/data-service"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/badges"
import { RuleTester } from "@/components/rule-tester"
import { YaraRulesManager } from "@/components/yara-rules-manager"
import { severityStyles, type ResponseRule, type Severity } from "@/lib/irm"
import { GitBranch, CheckCircle2, CircleSlash, Database, Cpu, FileCode2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RulesPage() {
  const user = await getCurrentTeamMember()

  const [yaraResult, responseRulesResult] = await Promise.all([
    fetchYaraRules(),
    fetchResponseRules(),
  ])

  const yaraRules = yaraResult.data
  const responseRules = responseRulesResult.data

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Detection & Response Rules"
        description="Configure YARA pattern metadata and the Arithmetic Unit (AU) risk triage policy."
      />

      {/* Storage Backend status */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Storage Backend:</span>
          {yaraResult.isSupabase ? (
            <span className="text-emerald-400 font-medium">Supabase &apos;yara_rules&apos; (Live Cloud Sync)</span>
          ) : (
            <span className="text-muted-foreground">
              Local Prototype Store (Synchronized in-memory)
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {yaraRules.length} YARA rules · {responseRules.length} AU policies
        </span>
      </div>

      {/* Section 1: YARA Rules Engine (Module 4) */}
      <div className="space-y-4">
        <div className="border-b border-border pb-2 flex items-center gap-2">
          <FileCode2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">YARA Rules & Static Signatures</h2>
        </div>
        <YaraRulesManager initialRules={yaraRules} />
      </div>

      {/* Section 2: AU Response Rules & Interactive Tester */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="border-b border-border pb-2 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-chart-2" />
          <h2 className="text-lg font-semibold text-foreground">
            Arithmetic Unit (AU) Response Policy Matrix
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {responseRules.map((rule) => {
              const s = severityStyles(rule.severity as Severity)
              return (
                <Card key={rule.id}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${s.soft}`}>
                        <GitBranch className={`h-4 w-4 ${s.text}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            {rule.rule_id}
                          </span>
                          <p className="font-semibold text-sm">{rule.rule_name}</p>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          IF <span className="text-foreground">{rule.condition}</span> THEN classify as{" "}
                          <span className={s.text}>{rule.severity}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={rule.severity as Severity} />
                      {rule.is_active ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="border-muted-foreground/30 bg-muted text-muted-foreground">
                          <CircleSlash className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="space-y-4">
            <RuleTester />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AU Pipeline Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <p>
                  The <strong className="text-chart-2">Arithmetic Unit (AU)</strong> computes{" "}
                  <code className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">
                    Risk = Likelihood × Impact
                  </code>.
                </p>
                <p>
                  The <strong className="text-primary">IRM</strong> matches the calculated integer against these rules to tag an operational severity (Low, Medium, High, or Critical).
                </p>
                <p>
                  The <strong className="text-chart-3">Graphical Unit (GU)</strong> then aggregates and renders the telemetry in real-time.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
