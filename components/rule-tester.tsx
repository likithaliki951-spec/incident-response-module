"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/badges"
import { classifyRisk } from "@/lib/irm"
import { FlaskConical } from "lucide-react"

export function RuleTester() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<{ score: number; severity: ReturnType<typeof classifyRisk> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function test() {
    setError(null)
    const score = Number(input)
    if (input.trim() === "" || !Number.isFinite(score)) {
      setError("Enter a numeric risk score.")
      setResult(null)
      return
    }
    if (score < 0 || score > 100) {
      setError("Risk score must be between 0 and 100.")
      setResult(null)
      return
    }
    setResult({ score: Math.round(score), severity: classifyRisk(score) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          Test Rule
        </CardTitle>
        <CardDescription>Enter a risk score to see how the IRM would classify it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) test()
            }}
            placeholder="0 – 100"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={test}>Evaluate</Button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {result && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Risk Score</p>
              <p className="font-mono text-2xl font-semibold">{result.score}</p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Resulting Severity</p>
              <SeverityBadge severity={result.severity} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
