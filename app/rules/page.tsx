import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/badges"
import { RuleTester } from "@/components/rule-tester"
import { severityStyles, type ResponseRule, type Severity } from "@/lib/irm"
import { GitBranch, CheckCircle2, CircleSlash } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RulesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("response_rules")
    .select("*")
    .order("rule_id", { ascending: true })

  const rules = (data ?? []) as ResponseRule[]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pt-20 lg:px-8 lg:pt-8">
      <PageHeader
        title="Response Rules"
        description="The rule set the IRM applies to translate a computed risk score into a severity and response."
      />

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-400">Failed to load rules: {error.message}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {rules.map((rule) => {
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
                        <span className="font-mono text-xs text-muted-foreground">{rule.rule_id}</span>
                        <p className="font-semibold">{rule.rule_name}</p>
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

          {rules.length === 0 && !error && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No response rules configured.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <RuleTester />
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The <span className="text-chart-2">Arithmetic Unit</span> computes{" "}
                <span className="font-mono text-foreground">Risk = Likelihood × Impact</span>.
              </p>
              <p>
                The <span className="text-primary">IRM</span> matches that score against these rules to assign a
                severity, then persists the incident for the{" "}
                <span className="text-chart-3">Graphical Unit</span> to render.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
