"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { classifyRisk, type IncidentStatus } from "@/lib/irm"

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createIncident(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("incident_name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const likelihood = Number(formData.get("likelihood"))
  const impact = Number(formData.get("impact"))

  if (!name) return { ok: false, error: "Incident name is required." }
  if (!Number.isFinite(likelihood) || likelihood < 0 || likelihood > 1) {
    return { ok: false, error: "Likelihood must be between 0 and 1." }
  }
  if (!Number.isFinite(impact) || impact < 0 || impact > 100) {
    return { ok: false, error: "Impact must be between 0 and 100." }
  }

  // Arithmetic Unit: Risk = Likelihood x Impact
  const risk = Math.round(likelihood * impact)
  // IRM: classify risk into severity via response rules
  const severity = classifyRisk(risk)

  const supabase = await createClient()

  const { count } = await supabase.from("incidents").select("*", { count: "exact", head: true })
  const incidentId = `INC-${1001 + (count ?? 0)}`

  const { error } = await supabase.from("incidents").insert({
    incident_id: incidentId,
    incident_name: name,
    severity,
    risk_score: risk,
    status: "Open" satisfies IncidentStatus,
    description: description || null,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")
  return { ok: true }
}

export async function updateIncidentStatus(id: string, status: IncidentStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("incidents").update({ status }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/incidents")
  revalidatePath("/")
  revalidatePath("/reports")
  return { ok: true }
}
