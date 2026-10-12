export interface TeamMemberProfile {
  id?: string
  email: string
  name: string
  role: string
  isCloudSupabase: boolean
}

// Explicit pre-authorized team accounts for local development prototype only
export const LOCAL_AUTHORIZED_TEAM = [
  {
    email: "team@secops.local",
    name: "SecOps Team Lead",
    role: "Incident Lead Responder",
    password: "SecOps2026!",
  },
  {
    email: "analyst@secops.local",
    name: "SOC Senior Analyst",
    role: "Threat Hunter",
    password: "SecOps2026!",
  },
]
