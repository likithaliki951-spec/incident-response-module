"use client"

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { severityStyles, type Severity } from "@/lib/irm"

export function RiskDistributionChart({
  data,
}: {
  data: { severity: Severity; count: number }[]
}) {
  const chartData = data.filter((d) => d.count > 0)
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return <EmptyChart label="No incident data" />
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="severity"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          stroke="none"
        >
          {chartData.map((entry) => (
            <Cell key={entry.severity} fill={severityStyles(entry.severity).hex} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "oklch(0.21 0.025 258)",
            border: "1px solid oklch(0.7 0.05 255 / 0.2)",
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ResponseTimelineChart({
  data,
}: {
  data: { day: string; incidents: number }[]
}) {
  const hasData = data.some((d) => d.incidents > 0)
  if (!hasData) return <EmptyChart label="No activity in range" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.05 255 / 0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "oklch(0.62 0.19 255 / 0.1)" }}
          contentStyle={{
            background: "oklch(0.21 0.025 258)",
            border: "1px solid oklch(0.7 0.05 255 / 0.2)",
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
          }}
        />
        <Bar dataKey="incidents" fill="oklch(0.62 0.19 255)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
