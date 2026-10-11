"use client"

import { useState, useTransition } from "react"
import { createIncidentReport } from "@/app/actions"
import { SeverityBadge, RiskMeter } from "@/components/badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { escapeHtml, formatDateTime, type Incident, type IncidentReport, type Severity } from "@/lib/irm"
import {
  FileDown,
  FileBarChart,
  Eye,
  Check,
  ShieldAlert,
  Calculator,
  Download,
  Clock,
  Sparkles,
  User,
} from "lucide-react"

export function ReportGenerator({
  incidents,
  initialReports,
}: {
  incidents: Incident[]
  initialReports: IncidentReport[]
}) {
  const [reports, setReports] = useState<IncidentReport[]>(initialReports)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || "")
  const [reportTitle, setReportTitle] = useState("")
  const [analysisResult, setAnalysisResult] = useState("")
  const [responseNotes, setResponseNotes] = useState("")
  const [responderName, setResponderName] = useState("SecOps Lead Analyst")
  const [previewReport, setPreviewReport] = useState<IncidentReport | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const currentIncident = incidents.find((i) => i.id === selectedIncidentId || i.incident_id === selectedIncidentId) || incidents[0]

  // Build standalone self-contained HTML report with strict escaping
  function buildStandaloneHtml(report: {
    incidentId: string
    incidentName: string
    description: string
    likelihood: number
    impact: number
    riskScore: number
    severity: Severity
    reportTitle: string
    analysisResult: string
    responseNotes: string
    responderName: string
    createdAt: string
  }): string {
    const safeTitle = escapeHtml(report.reportTitle)
    const safeIncId = escapeHtml(report.incidentId)
    const safeName = escapeHtml(report.incidentName)
    const safeDesc = escapeHtml(report.description)
    const safeAnalysis = escapeHtml(report.analysisResult)
    const safeResponse = escapeHtml(report.responseNotes)
    const safeResponder = escapeHtml(report.responderName)
    const safeCreated = escapeHtml(formatDateTime(report.createdAt))
    const safeGenTime = escapeHtml(new Date().toUTCString())

    const severityColor =
      report.severity === "Critical"
        ? "#ef4444"
        : report.severity === "High"
        ? "#f97316"
        : report.severity === "Medium"
        ? "#f59e0b"
        : "#10b981"

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Incident Response Module (IRM) Reporting Engine">
  <title>${safeTitle} - ${safeIncId}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --border: #1f2937;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --primary: #38bdf8;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 32px 16px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      padding: 32px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .meta {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .content {
      padding: 32px;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      font-family: monospace;
      color: #ffffff;
    }
    .text-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .footer {
      background: #090d16;
      border-top: 1px solid var(--border);
      padding: 20px 32px;
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .container { border: none; box-shadow: none; max-width: 100%; }
      .stat-card, .text-box { background: #f9fafb; border-color: #e5e7eb; color: #111; }
      .stat-value { color: #000; }
      .section-title { color: #1e40af; border-color: #e5e7eb; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge" style="background: ${severityColor}22; color: ${severityColor}; border: 1px solid ${severityColor}44;">
        ${escapeHtml(report.severity)} SEVERITY INCIDENT
      </div>
      <h1 class="title">${safeTitle}</h1>
      <div class="meta">
        <span>Incident ID: <strong>${safeIncId}</strong></span>
        <span>Logged: <strong>${safeCreated}</strong></span>
        <span>Lead Responder: <strong>${safeResponder}</strong></span>
      </div>
    </div>

    <div class="content">
      <!-- AU Arithmetic Unit Breakdown -->
      <div class="section">
        <h2 class="section-title">1. Arithmetic Unit (AU) Risk Matrix</h2>
        <div class="grid">
          <div class="stat-card">
            <div class="stat-label">Likelihood (Probability 0 - 1)</div>
            <div class="stat-value">${report.likelihood.toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Impact (Damage Potential 0 - 100)</div>
            <div class="stat-value">${report.impact}</div>
          </div>
          <div class="stat-card" style="border-left: 3px solid ${severityColor}">
            <div class="stat-label">AU Computed Risk Score (L × I)</div>
            <div class="stat-value" style="color: ${severityColor}">${report.riskScore} / 100</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">IRM Classified Severity</div>
            <div class="stat-value" style="color: ${severityColor}">${escapeHtml(report.severity)}</div>
          </div>
        </div>
      </div>

      <!-- Incident Context -->
      <div class="section">
        <h2 class="section-title">2. Incident Description & Scope</h2>
        <div class="text-box">${safeDesc || "No specific incident description provided."}</div>
      </div>

      <!-- Forensic Analysis -->
      <div class="section">
        <h2 class="section-title">3. Forensic Findings & Malware Analysis</h2>
        <div class="text-box">${safeAnalysis || "Forensic analysis completed with no anomalous secondary payloads flagged."}</div>
      </div>

      <!-- Incident Response Notes & Remediation Plan -->
      <div class="section">
        <h2 class="section-title">4. Response Actions & Containment Notes</h2>
        <div class="text-box">${safeResponse || "Standard incident containment procedures applied."}</div>
      </div>
    </div>

    <div class="footer">
      <span>Generated by IRM Console · Incident Response Module</span>
      <span>Timestamp: ${safeGenTime}</span>
    </div>
  </div>
</body>
</html>`
  }

  function handleGenerateAndDownload() {
    if (!currentIncident) return

    const likelihood = currentIncident.likelihood ?? (currentIncident.risk_score / 100)
    const impact = currentIncident.impact ?? 100
    const title = reportTitle.trim() || `Incident Report: ${currentIncident.incident_name}`
    const analysis = analysisResult.trim() || `AU computed risk score ${currentIncident.risk_score} (${currentIncident.severity}). Matched against IRM detection rule matrix.`
    const notes = responseNotes.trim() || `Host contained. Status transitioned to ${currentIncident.status}. Telemetry verified in SOC dashboard.`

    const reportData = {
      incidentId: currentIncident.incident_id,
      incidentName: currentIncident.incident_name,
      description: currentIncident.description || "",
      likelihood,
      impact,
      riskScore: currentIncident.risk_score,
      severity: currentIncident.severity,
      reportTitle: title,
      analysisResult: analysis,
      responseNotes: notes,
      responderName: responderName.trim() || "SecOps Analyst",
      createdAt: currentIncident.created_at,
    }

    // 1. Build standalone downloadable HTML
    const html = buildStandaloneHtml(reportData)
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `incident-report-${currentIncident.incident_id}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setDownloadSuccess(true)
    setTimeout(() => setDownloadSuccess(false), 3000)

    // 2. Persist metadata to Supabase 'reports' table & memory store
    startTransition(async () => {
      const res = await createIncidentReport({
        incidentId: currentIncident.incident_id,
        reportTitle: title,
        riskScore: currentIncident.risk_score,
        severity: currentIncident.severity,
        analysisResult: analysis,
        responseNotes: notes,
        generatedBy: responderName.trim() || "SecOps Analyst",
      })
      if (res.ok && res.data) {
        setReports((prev) => [res.data!, ...prev])
      }
    })
  }

  function handleDownloadExisting(rep: IncidentReport) {
    const inc = incidents.find((i) => i.incident_id === rep.incident_id)
    const html = buildStandaloneHtml({
      incidentId: rep.incident_id,
      incidentName: rep.report_title,
      description: inc?.description || "",
      likelihood: inc?.likelihood ?? (rep.risk_score / 100),
      impact: inc?.impact ?? 100,
      riskScore: rep.risk_score,
      severity: rep.severity,
      reportTitle: rep.report_title,
      analysisResult: rep.analysis_result,
      responseNotes: rep.response_notes,
      responderName: rep.generated_by || "SecOps Analyst",
      createdAt: rep.created_at,
    })

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `incident-report-${rep.incident_id}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Report Generator Studio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-4 w-4 text-primary" />
            Generate Standalone HTML Incident Report
          </CardTitle>
          <CardDescription>
            Produces a self-contained, sanitized HTML file with AU risk metrics, malware triage, and response notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Select Incident Subject</label>
              <select
                value={selectedIncidentId}
                onChange={(e) => {
                  setSelectedIncidentId(e.target.value)
                  const inc = incidents.find((i) => i.id === e.target.value || i.incident_id === e.target.value)
                  if (inc) {
                    setReportTitle(`Forensic Triage Report: ${inc.incident_name}`)
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.incident_id} — {i.incident_name} ({i.severity})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Lead Responder Name / Role</label>
              <input
                value={responderName}
                onChange={(e) => setResponderName(e.target.value)}
                placeholder="e.g. Lead Analyst, SOC Team 1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {currentIncident && (
            <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-chart-2" />
                  Arithmetic Unit (AU) Calculated Parameters
                </span>
                <SeverityBadge severity={currentIncident.severity} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-xs text-muted-foreground">
                <p>Likelihood: <strong className="text-foreground font-mono">{(currentIncident.likelihood ?? 0.5).toFixed(2)}</strong></p>
                <p>Impact: <strong className="text-foreground font-mono">{currentIncident.impact ?? 50}</strong></p>
                <p>Risk Score: <strong className="text-primary font-mono">{currentIncident.risk_score}</strong>/100</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Report Document Title</label>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder={`Forensic Triage Report: ${currentIncident?.incident_name || ""}`}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Analysis & Malware Findings</label>
              <textarea
                rows={3}
                value={analysisResult}
                onChange={(e) => setAnalysisResult(e.target.value)}
                placeholder="Detailed findings, SHA-256 matches, YARA heuristics triggered…"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Response Actions & Containment Notes</label>
              <textarea
                rows={3}
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="Firewall blocks, quarantine steps, account resets, remediation schedule…"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {downloadSuccess && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> HTML Report downloaded & saved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleGenerateAndDownload} disabled={pending}>
                <Download className="h-4 w-4 mr-1.5" />
                {pending ? "Generating…" : "Generate & Download HTML Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Reports Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated Incident Reports Catalog</CardTitle>
          <CardDescription>Persisted in Supabase &apos;reports&apos; table</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-center py-10 text-xs text-muted-foreground">No reports generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Incident ID</th>
                    <th className="px-4 py-3 font-medium">Report Title</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Risk Score</th>
                    <th className="px-4 py-3 font-medium">Generated By</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {rep.incident_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                        {rep.report_title}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={rep.severity} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RiskMeter score={rep.risk_score} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {rep.generated_by || "SecOps Analyst"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(rep.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDownloadExisting(rep)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          title="Download standalone HTML"
                        >
                          <Download className="h-3.5 w-3.5" /> HTML
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
