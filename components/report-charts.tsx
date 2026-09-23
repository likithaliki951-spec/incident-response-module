"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts"

const tooltipStyle = {
  background: "oklch(0.21 0.025 258)",
  border: "1px solid oklch(0.7 0.05 255 / 0.2)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
}

export function SeverityBarChart({ data }: { data: { severity: string; count: number; hex: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.05 255 / 0.1)" vertical={false} />
        <XAxis dataKey="severity" tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "oklch(0.62 0.19 255 / 0.08)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {data.map((d) => (
            <Cell key={d.severity} fill={d.hex} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TrendLineChart({ data }: { data: { day: string; risk: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.05 255 / 0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.03 255)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="risk"
          stroke="oklch(0.62 0.19 255)"
          strokeWidth={2}
          dot={{ r: 3, fill: "oklch(0.62 0.19 255)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
