"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import {
  LayoutDashboard,
  ShieldAlert,
  Bug,
  Radar,
  FileCode2,
  FileBarChart,
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logoutAction } from "@/app/auth-actions"
import type { TeamMemberProfile } from "@/lib/auth"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incident Management", icon: ShieldAlert },
  { href: "/malware", label: "Malware Analysis", icon: Bug },
  { href: "/threats", label: "Threat Intelligence", icon: Radar },
  { href: "/rules", label: "YARA & Response Rules", icon: FileCode2 },
  { href: "/reports", label: "Reports & Analytics", icon: FileBarChart },
]

export function Sidebar({ user }: { user?: TeamMemberProfile | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isLoggingOut, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">IRM Console</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">IRM Console</p>
            <p className="text-[11px] text-muted-foreground">Incident Response Module</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-3">
          {/* User Profile & Mode Section */}
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5 space-y-2">
            {user ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-semibold">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-sidebar-foreground">
                        {user.name || "SecOps Analyst"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border/80 bg-background/60 py-1 px-2 text-[11px] font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-50"
                  title="Sign out of IRM Console"
                >
                  <LogOut className="h-3 w-3" />
                  <span>{isLoggingOut ? "Signing Out…" : "Log Out"}</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-sidebar-foreground">
                        Demo Visitor
                      </p>
                      <p className="truncate text-[10px] text-amber-400 font-mono">
                        Local Prototype Mode
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 py-1.5 px-2 text-[11px] font-medium text-primary hover:bg-primary/20 transition-all"
                  title="Sign in as Team Member"
                >
                  <span>Team Sign In</span>
                </Link>
              </>
            )}
          </div>

          {/* Architecture Pipeline indicator */}
          <div className="rounded-lg bg-sidebar-accent/50 p-2.5 ring-1 ring-sidebar-border">
            <div className="flex items-center justify-between font-mono text-[10px] mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Pipeline
              </span>
              <span className="text-emerald-400 font-sans">Active</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-chart-2 font-medium" title="Arithmetic Unit">
                AU
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-primary font-medium" title="Incident Response Module">
                IRM
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-chart-3 font-medium" title="Graphical Unit">
                GU
              </span>
            </div>
          </div>

          {/* Database mode badge */}
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", user ? "bg-emerald-400" : "bg-amber-400")} />
              <span>{user ? "Authenticated" : "Demo Mode"}</span>
            </span>
            <span className="font-mono text-[10px] rounded bg-muted/60 px-1.5 py-0.5">
              {user ? (user.isCloudSupabase ? "Supabase Cloud" : "Team Session") : "In-Memory Store"}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
