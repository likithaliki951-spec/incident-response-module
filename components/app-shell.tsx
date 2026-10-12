"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import type { TeamMemberProfile } from "@/lib/auth"

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: TeamMemberProfile | null
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    return <main className="min-h-screen min-w-0 bg-background">{children}</main>
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 lg:pl-64">{children}</main>
    </div>
  )
}
