import { isSupabaseConfigured } from "@/lib/supabase/server"
import { LoginForm } from "@/components/login-form"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  const isCloud = isSupabaseConfigured()
  const isProduction = process.env.NODE_ENV === "production"

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md py-8">
        <LoginForm isCloudSupabase={isCloud} isProduction={isProduction} />
      </div>
    </div>
  )
}
