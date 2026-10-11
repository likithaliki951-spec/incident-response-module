import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Sidebar } from "@/components/sidebar"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
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
