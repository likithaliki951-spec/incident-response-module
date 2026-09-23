import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { Analytics } from "@vercel/analytics/next"
import { Sidebar } from "@/components/sidebar"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "IRM · Incident Response Module",
  description:
    "Incident Response Module dashboard — Arithmetic Unit (AU) risk analysis integrated with a Graphical Unit (GU) security operations dashboard.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} `}>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 min-w-0 lg:pl-64">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  )
}
