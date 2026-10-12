import { cookies } from "next/headers"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getSafeRedirectUrl } from "@/lib/redirect"
import { LOCAL_AUTHORIZED_TEAM, type TeamMemberProfile } from "@/lib/auth-constants"

export { getSafeRedirectUrl, LOCAL_AUTHORIZED_TEAM, type TeamMemberProfile }

/**
 * Server-side helper to retrieve and verify the active authenticated team member.
 * Does NOT read localStorage. Uses server-side verified HTTP cookies.
 * Strictly verifies BOTH authentication and active team membership.
 */
export async function getCurrentTeamMember(): Promise<TeamMemberProfile | null> {
  // 1. Live Supabase Authentication Mode
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        // Recommended server-side verification: getUser() contacts Supabase Auth to validate JWT
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!error && user && user.email) {
          // Strictly verify that the user is an active authorized team member
          const authCheck = await verifyTeamAuthorization(user.email, user.id)
          if (!authCheck.authorized) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name:
              user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              user.email.split("@")[0].toUpperCase(),
            role: authCheck.role || "SecOps Analyst",
            isCloudSupabase: true,
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") throw err
      console.warn("[IRM Auth] Error verifying Supabase server session:", err)
    }
    return null
  }

  // In production, prototype fallback is strictly disabled
  if (process.env.NODE_ENV === "production") {
    return null
  }

  // 2. Local Prototype / Fallback Mode (Development only): Check secure HTTP session cookie
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("irm_team_session")

    if (sessionCookie?.value) {
      const parsed = JSON.parse(sessionCookie.value) as {
        email: string
        name?: string
        role?: string
      }
      if (parsed && parsed.email) {
        // Validate against local authorized team
        const match = LOCAL_AUTHORIZED_TEAM.find(
          (t) => t.email.toLowerCase() === parsed.email.toLowerCase()
        )
        if (match) {
          return {
            email: match.email,
            name: match.name,
            role: match.role,
            isCloudSupabase: false,
          }
        }
      }
    }
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") throw err
    console.warn("[IRM Auth] Error parsing local team session cookie:", err)
  }

  return null
}

/**
 * Verifies whether a given authenticated account belongs to the authorized project team.
 * Fail-closed: An empty roster or any database error strictly denies access.
 */
export async function verifyTeamAuthorization(
  email: string,
  userId?: string
): Promise<{ authorized: boolean; reason?: string; role?: string }> {
  const normalizedEmail = email.trim().toLowerCase()

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        // Query public.team_members table for active membership
        const { data: teamRows, error: teamError } = await supabase
          .from("team_members")
          .select("email, user_id, role, is_active")
          .eq("is_active", true)

        if (teamError) {
          console.warn("[IRM Auth] Database query error on team_members:", teamError.message)
          return {
            authorized: false,
            reason: "Access Denied: Could not verify team authorization against database roster.",
          }
        }

        // Fail-closed: Empty team_members table denies access to everyone
        if (!teamRows || teamRows.length === 0) {
          return {
            authorized: false,
            reason:
              "Access Denied: Team roster is empty. An administrator must provision authorized accounts.",
          }
        }

        const match = teamRows.find(
          (r: { email: string; user_id?: string }) =>
            r.email.toLowerCase() === normalizedEmail ||
            (userId && r.user_id === userId)
        )

        if (match) {
          return { authorized: true, role: match.role || "SecOps Analyst" }
        }

        return {
          authorized: false,
          reason: "Access Denied: Account is not on the active project-team authorization list.",
        }
      }
    } catch (err) {
      console.warn("[IRM Auth] Error checking team_members table:", err)
      return {
        authorized: false,
        reason: "Access Denied: Team authorization check encountered a server error.",
      }
    }

    return {
      authorized: false,
      reason: "Access Denied: Supabase client connection unavailable.",
    }
  }

  // Prototype Mode: Strictly forbidden in production
  if (process.env.NODE_ENV === "production") {
    return {
      authorized: false,
      reason: "Configuration Error: Live Supabase database authentication is required in production.",
    }
  }

  // Local Prototype check (Development only)
  const localMatch = LOCAL_AUTHORIZED_TEAM.find(
    (t) => t.email.toLowerCase() === normalizedEmail
  )
  if (localMatch) {
    return { authorized: true, role: localMatch.role }
  }

  return {
    authorized: false,
    reason:
      "Access Denied: Account not found in the authorized local development roster.",
  }
}
