"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { verifyTeamAuthorization, LOCAL_AUTHORIZED_TEAM } from "@/lib/auth"

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string }

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "").trim()

  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid team email address is required." }
  }

  if (!password) {
    return { ok: false, error: "Password is required." }
  }

  // 1. Live Supabase Authentication Mode
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (!supabase) {
        return { ok: false, error: "Supabase connection could not be established." }
      }

      // Perform server-side password authentication (tokens are set into cookies by @supabase/ssr)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        return {
          ok: false,
          error: error?.message || "Invalid email or password. Access denied.",
        }
      }

      // Verify that this account is an authorized project-team member (Requirement 6)
      const authCheck = await verifyTeamAuthorization(data.user.email || email, data.user.id)
      if (!authCheck.authorized) {
        // Sign out unauthorized visitor immediately
        await supabase.auth.signOut()
        return {
          ok: false,
          error:
            authCheck.reason ||
            "Access Denied: Your account is not on the authorized IRM project team roster.",
        }
      }

      return { ok: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Authentication error: ${msg}` }
    }
  }

  // 2. Production Guard: Prototype mode forbidden in production
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "Configuration Error: Live Supabase database authentication is required in production. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    }
  }

  // 3. Local Development Prototype Mode (Development only)
  const localMatch = LOCAL_AUTHORIZED_TEAM.find(
    (t) => t.email.toLowerCase() === email.toLowerCase()
  )

  if (localMatch) {
    if (password !== localMatch.password) {
      return { ok: false, error: "Incorrect password for local team account." }
    }

    const cookieStore = await cookies()
    cookieStore.set(
      "irm_team_session",
      JSON.stringify({
        email: localMatch.email,
        name: localMatch.name,
        role: localMatch.role,
        authenticatedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      }
    )

    return { ok: true }
  }

  return {
    ok: false,
    error:
      "Access Denied: Unrecognized team account for development prototype. Allowed accounts: team@secops.local, analyst@secops.local.",
  }
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.warn("[IRM Auth] Error during Supabase signOut:", err)
    }
  }

  const cookieStore = await cookies()
  cookieStore.delete("irm_team_session")

  redirect("/login")
}
