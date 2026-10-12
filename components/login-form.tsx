"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { loginAction } from "@/app/auth-actions"
import { getSafeRedirectUrl } from "@/lib/redirect"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  KeyRound,
  Sparkles,
  ArrowRight,
  Database,
  Cpu,
} from "lucide-react"

export function LoginForm({
  isCloudSupabase,
  isProduction = false,
}: {
  isCloudSupabase: boolean
  isProduction?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get("redirect")
  const redirectTarget = getSafeRedirectUrl(rawRedirect)
  const urlError = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (urlError === "unauthorized") {
      setError(
        "Access Denied: Your account is authenticated, but is not on the active project-team authorization list."
      )
    } else if (urlError === "config_required") {
      setError(
        "Configuration Error: Live Supabase database authentication is required in production."
      )
    } else if (urlError === "session_expired") {
      setError("Session Expired: Please sign in again.")
    }
  }, [urlError])

  function handleFillDemo() {
    setEmail("team@secops.local")
    setPassword("SecOps2026!")
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (isProduction && !isCloudSupabase) {
      setError("Live Supabase credentials are required in production. Prototype login is disabled.")
      return
    }

    const formData = new FormData()
    formData.set("email", email)
    formData.set("password", password)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (result.ok) {
        router.push(redirectTarget)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Brand & Security Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          IRM Console Authentication
        </h1>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Incident Response Module · Arithmetic Unit (AU) Risk Telemetry
        </p>
      </div>

      <Card className="border-border bg-card/95 shadow-2xl backdrop-blur-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-chart-2 via-primary to-chart-3" />

        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-red-400">
              <Lock className="h-3 w-3" /> Team-Only Access
            </span>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              {isCloudSupabase ? "Supabase Cloud" : "Prototype Mode"}
            </span>
          </div>
          <CardTitle className="text-base font-semibold pt-1">Sign In to Continue</CardTitle>
          <CardDescription className="text-xs">
            Enter your provisioned team credentials to access the SOC console.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-red-200">Authentication Failed</p>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="team-email" className="text-xs font-medium text-muted-foreground">
                Team Member Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="team-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@secops.local"
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="team-password" className="text-xs font-medium text-muted-foreground">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="team-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
            </div>

            <Button type="submit" disabled={pending} className="w-full font-medium">
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Verifying Session…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Authorize & Sign In <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>

            <div className="pt-2 border-t border-border/50 text-center space-y-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 py-2 px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>Continue in Demo Mode (No Login Required)</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {!isCloudSupabase && !isProduction && (
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-mono"
                >
                  <Sparkles className="h-3 w-3" />
                  Fill Demo Credentials (team@secops.local)
                </button>
              )}
            </div>

            {isProduction && !isCloudSupabase && (
              <div className="pt-2 border-t border-border/50 text-center">
                <p className="text-xs text-amber-400 font-mono">
                  Production notice: Live Supabase database configuration is required for cloud persistence.
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Security Policy Notice */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span>Access Control Policy</span>
        </div>
        <p className="leading-relaxed">
          Public self-registration is strictly disabled. Only authorized project-team accounts can access the IRM console. 
          Session tokens are validated server-side in secure HTTP-only cookies without localStorage persistence.
        </p>
      </div>
    </div>
  )
}
