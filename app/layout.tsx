import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppShell } from "@/components/app-shell"
import { getCurrentTeamMember } from "@/lib/auth"
import { Suspense } from "react"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "IRM · Incident Response Module",
  description:
    "Incident Response Module dashboard — Arithmetic Unit (AU) risk analysis integrated with a Graphical Unit (GU) security operations dashboard.",
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentTeamMember()

  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <AppShell user={user}>
          <Suspense fallback={null}>{children}</Suspense>
        </AppShell>
        <Analytics />
      </body>
    </html>
  )
}
