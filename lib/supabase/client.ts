import { createBrowserClient } from "@supabase/ssr"

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url && key && url.startsWith("http") && !url.includes("your-project-id"))
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || !url.startsWith("http") || url.includes("your-project-id")) {
    return null
  }

  return createBrowserClient(url, key)
}
