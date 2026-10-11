import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { memoryStore } from "@/lib/mock-data"
import type { Incident, MalwareTest, YaraRule, IncidentReport, Threat, ResponseRule } from "@/lib/irm"

export interface DataFetchResult<T> {
  data: T
  isSupabase: boolean
  error?: string | null
}

export async function fetchIncidents(): Promise<DataFetchResult<Incident[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error && data && data.length > 0) {
          return { data: data as Incident[], isSupabase: true }
        }
        if (error) {
          console.warn("[IRM] Supabase incidents query failed, falling back to local store:", error.message)
          return { data: memoryStore.getIncidents(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn("[IRM] Supabase connection error:", message)
    }
  }
  return { data: memoryStore.getIncidents(), isSupabase: false }
}

export async function fetchMalwareTests(): Promise<DataFetchResult<MalwareTest[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("malware_tests")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error && data && data.length > 0) {
          return { data: data as MalwareTest[], isSupabase: true }
        }
        if (error) {
          return { data: memoryStore.getMalwareTests(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Malware tests fetch error:", err)
    }
  }
  return { data: memoryStore.getMalwareTests(), isSupabase: false }
}

export async function fetchYaraRules(): Promise<DataFetchResult<YaraRule[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("yara_rules")
          .select("*")
          .order("rule_id", { ascending: true })

        if (!error && data && data.length > 0) {
          return { data: data as YaraRule[], isSupabase: true }
        }
        if (error) {
          return { data: memoryStore.getYaraRules(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Yara rules fetch error:", err)
    }
  }
  return { data: memoryStore.getYaraRules(), isSupabase: false }
}

export async function fetchReports(): Promise<DataFetchResult<IncidentReport[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error && data && data.length > 0) {
          return { data: data as IncidentReport[], isSupabase: true }
        }
        if (error) {
          return { data: memoryStore.getReports(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Reports fetch error:", err)
    }
  }
  return { data: memoryStore.getReports(), isSupabase: false }
}

export async function fetchThreats(): Promise<DataFetchResult<Threat[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("threats")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error && data && data.length > 0) {
          return { data: data as Threat[], isSupabase: true }
        }
        if (error) {
          return { data: memoryStore.getThreats(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Threats fetch error:", err)
    }
  }
  return { data: memoryStore.getThreats(), isSupabase: false }
}

export async function fetchResponseRules(): Promise<DataFetchResult<ResponseRule[]>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data, error } = await supabase
          .from("response_rules")
          .select("*")
          .order("rule_id", { ascending: true })

        if (!error && data && data.length > 0) {
          return { data: data as ResponseRule[], isSupabase: true }
        }
        if (error) {
          return { data: memoryStore.getResponseRules(), isSupabase: false, error: error.message }
        }
      }
    } catch (err: unknown) {
      console.warn("[IRM] Response rules fetch error:", err)
    }
  }
  return { data: memoryStore.getResponseRules(), isSupabase: false }
}
