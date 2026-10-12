import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSafeRedirectUrl } from "@/lib/redirect"
import { LOCAL_AUTHORIZED_TEAM } from "@/lib/auth-constants"

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isCloudConfigured = Boolean(
    url && key && url.startsWith("http") && !url.includes("your-project-id")
  )
  const isProduction = process.env.NODE_ENV === "production"

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === "/login"

  // 1. Live Supabase Authentication Mode
  if (isCloudConfigured && url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Secure server-side validation using getUser()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Unauthenticated visitors: Allow access in Demo Mode without forcing redirect to /login
    if (!user) {
      return supabaseResponse
    }

    // Authenticated user exists: verify active team authorization (Fail-closed)
    let isAuthorized = false
    try {
      const normalizedEmail = (user.email || "").trim().toLowerCase()
      const { data: member, error: memberError } = await supabase
        .from("team_members")
        .select("id, is_active")
        .eq("is_active", true)
        .or(`user_id.eq.${user.id},email.eq.${normalizedEmail}`)
        .limit(1)
        .maybeSingle()

      if (!memberError && member && member.is_active) {
        isAuthorized = true
      }
    } catch {
      isAuthorized = false
    }

    // If authenticated in Supabase but not an authorized team member:
    if (!isAuthorized) {
      if (isLoginPage) {
        return supabaseResponse
      }
      // Show unauthorized state on login page
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/login"
      redirectUrl.searchParams.set("error", "unauthorized")
      return NextResponse.redirect(redirectUrl)
    }

    // Authenticated and AUTHORIZED team member: redirect away from /login to dashboard
    if (isLoginPage) {
      const rawRedirect = request.nextUrl.searchParams.get("redirect")
      const safeRedirect = getSafeRedirectUrl(rawRedirect)
      const redirectUrl = new URL(safeRedirect, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  }

  // 2. Production Environment Guard: Missing live Supabase configuration in production
  if (isProduction) {
    if (!isLoginPage) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/login"
      redirectUrl.searchParams.set("error", "config_required")
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  // 3. Local Prototype Mode (Development Only)
  const sessionCookie = request.cookies.get("irm_team_session")
  let hasValidDevSession = false

  if (sessionCookie?.value) {
    try {
      const parsed = JSON.parse(sessionCookie.value)
      if (
        parsed?.email &&
        LOCAL_AUTHORIZED_TEAM.some(
          (t) => t.email.toLowerCase() === String(parsed.email).toLowerCase()
        )
      ) {
        hasValidDevSession = true
      }
    } catch {
      hasValidDevSession = false
    }
  }

  if (!hasValidDevSession && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    const safeRedirect = getSafeRedirectUrl(pathname)
    if (safeRedirect !== "/") {
      redirectUrl.searchParams.set("redirect", safeRedirect)
    }
    return NextResponse.redirect(redirectUrl)
  }

  if (hasValidDevSession && isLoginPage) {
    const rawRedirect = request.nextUrl.searchParams.get("redirect")
    const safeRedirect = getSafeRedirectUrl(rawRedirect)
    const redirectUrl = new URL(safeRedirect, request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
