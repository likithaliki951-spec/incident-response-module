"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  ShieldAlert,
  Radar,
  GitBranch,
  FileBarChart,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incident Management", icon: ShieldAlert },
  { href: "/threats", label: "Threat Data", icon: Radar },
  { href: "/rules", label: "Response Rules", icon: GitBranch },
  { href: "/reports", label: "Reports", icon: FileBarChart },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">IRM</span>
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
            <p className="text-[11px] text-muted-foreground">Incident Response</p>
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent/50 p-3 ring-1 ring-sidebar-border">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Data Pipeline
            </p>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-chart-2">AU</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-primary">IRM</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-chart-3">GU</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-muted-foreground">Pipeline active</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
