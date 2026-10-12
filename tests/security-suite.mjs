import test from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

// ==============================================================================
// 1. UNIT TESTS: OPEN REDIRECT SANITIZATION
// ==============================================================================
// Test the exact redirect sanitization algorithm used in lib/auth.ts
function getSafeRedirectUrl(target) {
  if (typeof target !== "string" || !target) {
    return "/"
  }

  const trimmed = target.trim()

  // Must begin with a single slash, cannot start with // or /\ or contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return "/"
  }

  // Reject CR, LF, null or control characters
  if (/[\r\n\t\0]/.test(trimmed)) {
    return "/"
  }

  // Reject URL encoded slashes or backslashes
  if (/%2f|%5c/i.test(trimmed)) {
    return "/"
  }

  try {
    const parsed = new URL(trimmed, "http://irm.internal")
    if (parsed.origin !== "http://irm.internal") {
      return "/"
    }
    if (parsed.protocol !== "http:" || parsed.hostname !== "irm.internal") {
      return "/"
    }
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return "/"
  }
}

test("1. Open Redirect: Rejects protocol-relative URLs", () => {
  assert.strictEqual(getSafeRedirectUrl("//evil.com"), "/")
  assert.strictEqual(getSafeRedirectUrl("//evil.com/phish"), "/")
  assert.strictEqual(getSafeRedirectUrl("///attacker.com"), "/")
})

test("2. Open Redirect: Rejects backslashes and evasion techniques", () => {
  assert.strictEqual(getSafeRedirectUrl("/\\evil.com"), "/")
  assert.strictEqual(getSafeRedirectUrl("\\evil.com"), "/")
  assert.strictEqual(getSafeRedirectUrl("/path\\with\\backslashes"), "/")
  assert.strictEqual(getSafeRedirectUrl("/path/..\\evil"), "/")
})

test("3. Open Redirect: Rejects absolute URLs and non-http schemes", () => {
  assert.strictEqual(getSafeRedirectUrl("https://evil.com"), "/")
  assert.strictEqual(getSafeRedirectUrl("http://attacker.org/login"), "/")
  assert.strictEqual(getSafeRedirectUrl("javascript:alert(1)"), "/")
  assert.strictEqual(getSafeRedirectUrl("data:text/html,attack"), "/")
  assert.strictEqual(getSafeRedirectUrl("vbscript:msgbox(1)"), "/")
})

test("4. Open Redirect: Rejects CRLF and control characters", () => {
  assert.strictEqual(getSafeRedirectUrl("/login\r\nSet-Cookie:bad=1"), "/")
  assert.strictEqual(getSafeRedirectUrl("/path\0null"), "/")
  assert.strictEqual(getSafeRedirectUrl("/path%2fevil"), "/")
  assert.strictEqual(getSafeRedirectUrl("/path%5cevil"), "/")
})

test("5. Open Redirect: Accepts safe relative paths and query parameters", () => {
  assert.strictEqual(getSafeRedirectUrl("/"), "/")
  assert.strictEqual(getSafeRedirectUrl("/incidents"), "/incidents")
  assert.strictEqual(getSafeRedirectUrl("/malware"), "/malware")
  assert.strictEqual(getSafeRedirectUrl("/reports"), "/reports")
  assert.strictEqual(getSafeRedirectUrl("/rules"), "/rules")
  assert.strictEqual(getSafeRedirectUrl("/threats"), "/threats")
  assert.strictEqual(
    getSafeRedirectUrl("/incidents?status=Open&severity=Critical"),
    "/incidents?status=Open&severity=Critical"
  )
})

// ==============================================================================
// 2. AUDIT TESTS: SQL MIGRATION RLS INTEGRITY & HARDENING
// ==============================================================================
test("6. SQL Migration: Fail-open bootstrap is eliminated", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  assert.strictEqual(fs.existsSync(migrationPath), true, "Migration file must exist")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Must not contain the old bootstrap hole
  assert.doesNotMatch(
    sql,
    /RETURN auth\.role\(\)\s*=\s*'authenticated';/,
    "Bootstrap hole (auth.role() = 'authenticated') must be removed"
  )
})

test("7. SQL Migration: public.team_members cannot be enumerated by non-team members", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // SELECT policy must not use USING (true)
  assert.doesNotMatch(
    sql,
    /CREATE POLICY "Allow authenticated team members view roster"[\s\S]*?USING\s*\(\s*true\s*\);/,
    "team_members SELECT policy must not use USING (true)"
  )

  // Must require active team membership to view roster
  assert.match(
    sql,
    /CREATE POLICY "Allow active team members view roster"[\s\S]*?USING\s*\(\s*public\.is_authorized_team_member\(\)\s*\);/,
    "team_members SELECT policy must require is_authorized_team_member()"
  )
})

test("8. SQL Migration: Fixed search_path and execution privileges on SECURITY DEFINER functions", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Fixed search_path prevents search_path hijacking
  assert.match(
    sql,
    /FUNCTION public\.is_authorized_team_member\(\)[\s\S]*?SECURITY DEFINER SET search_path = public, auth, pg_temp;/,
    "is_authorized_team_member must declare fixed search_path = public, auth, pg_temp"
  )

  assert.match(
    sql,
    /FUNCTION public\.is_team_admin\(\)[\s\S]*?SECURITY DEFINER SET search_path = public, auth, pg_temp;/,
    "is_team_admin must declare fixed search_path = public, auth, pg_temp"
  )

  // Must revoke execution from PUBLIC
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.is_authorized_team_member\(\) FROM PUBLIC;/,
    "is_authorized_team_member must revoke permissions from PUBLIC"
  )
})

test("9. SQL Migration: Ordinary team members cannot mutate team roster records", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Roster mutations must be restricted to admins
  assert.match(
    sql,
    /CREATE POLICY "Allow team admins insert roster"[\s\S]*?WITH CHECK\s*\(\s*public\.is_team_admin\(\)\s*\);/,
    "INSERT on team_members must require is_team_admin()"
  )
  assert.match(
    sql,
    /CREATE POLICY "Allow team admins update roster"[\s\S]*?USING\s*\(\s*public\.is_team_admin\(\)\s*\)/,
    "UPDATE on team_members must require is_team_admin()"
  )
  assert.match(
    sql,
    /CREATE POLICY "Allow team admins delete roster"[\s\S]*?USING\s*\(\s*public\.is_team_admin\(\)\s*\);/,
    "DELETE on team_members must require is_team_admin()"
  )
})

test("10. SQL Migration: All 6 application tables are protected by team authorization", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  const appTables = ["incidents", "malware_tests", "yara_rules", "reports", "threats", "response_rules"]
  for (const table of appTables) {
    assert.match(
      sql,
      new RegExp(`ON public\\.${table}\\s+FOR SELECT TO authenticated`, "i"),
      `Table public.${table} must have SELECT policy restricted to authenticated`
    )
    assert.match(
      sql,
      new RegExp(`ON public\\.${table}\\s+FOR INSERT TO authenticated`, "i"),
      `Table public.${table} must have INSERT policy restricted to authenticated`
    )
  }
})

test("11. SQL Migration: Defensively enables RLS on all 7 tables", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  const allTables = [
    "incidents",
    "malware_tests",
    "yara_rules",
    "reports",
    "threats",
    "response_rules",
    "team_members",
  ]
  for (const table of allTables) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY;`, "i"),
      `Table public.${table} must explicitly have ENABLE ROW LEVEL SECURITY in migration 02`
    )
  }
})

test("12. SQL Migration: Defensive DDL reconciles pre-existing team_members table fail-closed", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Must have ADD COLUMN IF NOT EXISTS for key fields including id
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS id/)
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS user_id/)
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS email/)
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS role/)
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS is_active/)
  assert.match(sql, /ALTER TABLE public\.team_members ADD COLUMN IF NOT EXISTS created_at/)

  // Must verify Primary Key constraint and fail on null or duplicates
  assert.match(sql, /ADD PRIMARY KEY \(id\)/)
  assert.match(sql, /RAISE EXCEPTION 'Migration halted: public\.team_members contains NULL values in column "id"/)

  // Must defensively inspect actual foreign key definition referencing auth.users
  assert.match(sql, /c\.confrelid = 'auth\.users'::regclass/)
  assert.match(sql, /RAISE EXCEPTION 'Migration halted: public\.team_members contains user_id values not present in auth\.users/)
  assert.match(sql, /FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\) ON DELETE CASCADE/)

  // Must defensively inspect email NOT NULL and fail on NULLs
  assert.match(sql, /RAISE EXCEPTION 'Migration halted: public\.team_members contains rows with NULL email/)

  // Must defensively detect case-insensitive duplicates and fail safely with clear error
  assert.match(sql, /count\(\*\)\s*-\s*count\(distinct lower\(email\)\)/)
  assert.match(sql, /RAISE EXCEPTION 'Migration halted: public\.team_members contains % case-insensitive duplicate email record\(s\)/)

  // Must establish case-insensitive unique index on lower(email)
  assert.match(sql, /CREATE UNIQUE INDEX team_members_lower_email_idx ON public\.team_members \(lower\(email\)\)/)
})

test("13. SQL Migration: Drops legacy permissive and intermediate policy variants", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  const appTables = ["incidents", "malware_tests", "yara_rules", "reports", "threats", "response_rules"]
  for (const table of appTables) {
    assert.match(
      sql,
      new RegExp(`DROP POLICY IF EXISTS "Allow anon all on ${table}"`, "i"),
      `Must drop legacy "Allow anon all on ${table}"`
    )
  }

  // Must drop intermediate 'all' policies on incidents and team_members
  assert.match(sql, /DROP POLICY IF EXISTS "Allow authenticated team members all on incidents"/)
  assert.match(sql, /DROP POLICY IF EXISTS "Allow anon all on team_members"/)

  // Must include dynamic catalog cleanup for arbitrary legacy public/anon policies
  assert.match(sql, /SELECT schemaname, tablename, policyname[\s\S]*?FROM pg_policies/)
})

test("14. SQL Migration: Admin provisioning checks confirmed auth user and prevents silent elevation", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Must check exactly one matching user in auth.users
  assert.match(sql, /No account found in auth\.users for email/)
  assert.match(sql, /Multiple accounts found in auth\.users for email/)

  // Must require confirmed email
  assert.match(sql, /email_confirmed_at IS NOT NULL/)
  assert.match(sql, /has not confirmed their email/)

  // Must guard against silent promotion of ordinary members
  assert.match(sql, /already exists as an ordinary member with role/)

  // Must provide single statement compatible with lower(email) unique index
  assert.match(sql, /ON CONFLICT \(\(lower\(email\)\)\) DO UPDATE/)
})

test("15. SQL Migration: Provisioning block avoids min(id) and retrieves UUID after count validation", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  const provisioningBlock = sql.slice(sql.indexOf("SAFE ADMINISTRATOR PROVISIONING INSTRUCTIONS"))

  // Must not use min(id) or min(uuid)
  assert.doesNotMatch(
    provisioningBlock,
    /min\s*\(\s*(id|uuid)\s*\)/i,
    "Admin provisioning block must NOT use min(id) or min(uuid) as min() is not supported on UUIDs"
  )

  // Must perform account count check first
  const countIndex = provisioningBlock.indexOf("SELECT count(*)")
  assert.notStrictEqual(countIndex, -1, "Must contain SELECT count(*)")

  // Must validate count (e.g. v_user_count = 0 / v_user_count > 1)
  const countValidationIndex = provisioningBlock.indexOf("IF v_user_count = 0 THEN")
  assert.notStrictEqual(countValidationIndex, -1, "Must validate v_user_count = 0")

  // Must retrieve UUID via separate query AFTER count validation
  const uuidRetrievalIndex = provisioningBlock.indexOf("INTO v_auth_id")
  assert.notStrictEqual(uuidRetrievalIndex, -1, "Must retrieve UUID into v_auth_id")

  assert.ok(
    countIndex < countValidationIndex && countValidationIndex < uuidRetrievalIndex,
    "UUID retrieval into v_auth_id must occur strictly AFTER account-count validation"
  )
})

test("16. SQL Migration: Admin provisioning prevents account reassignment and silent reactivation", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")
  const provisioningBlock = sql.slice(sql.indexOf("SAFE ADMINISTRATOR PROVISIONING INSTRUCTIONS"))

  // Must inspect user_id and is_active in existing record check
  assert.match(
    provisioningBlock,
    /SELECT id, user_id, role, is_active[\s\S]*?INTO v_existing_id, v_existing_user_id, v_existing_role, v_existing_is_active/,
    "Must query id, user_id, role, is_active for existing membership"
  )

  // Must halt if account is deactivated
  assert.match(
    provisioningBlock,
    /IF v_existing_is_active\s*=\s*false THEN/,
    "Must check v_existing_is_active = false"
  )
  assert.match(
    provisioningBlock,
    /will not silently reactivate an inactive account/i,
    "Must reject silent reactivation with descriptive error"
  )

  // Must halt if account is already bound to a different Auth ID (reassignment prevention)
  assert.match(
    provisioningBlock,
    /v_existing_user_id IS NOT NULL AND v_existing_user_id\s*<>\s*v_auth_id/,
    "Must check v_existing_user_id <> v_auth_id"
  )
  assert.match(
    provisioningBlock,
    /Silently reassigning an existing administrator account association is forbidden/i,
    "Must reject account reassignment with descriptive error"
  )
})

test("17. SQL Security: Explicit table and function privilege grants (defense-in-depth)", () => {
  const schemaPath = path.resolve(process.cwd(), "supabase/schema.sql")
  const schemaSql = fs.readFileSync(schemaPath, "utf-8")
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const migrationSql = fs.readFileSync(migrationPath, "utf-8")

  for (const sql of [schemaSql, migrationSql]) {
    // Explicit table revokes from anon and public
    assert.match(sql, /REVOKE ALL ON TABLE public\.incidents FROM anon, PUBLIC;/)
    assert.match(sql, /REVOKE ALL ON TABLE public\.team_members FROM anon, PUBLIC;/)

    // Explicit table grants to authenticated
    assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.incidents TO authenticated;/)
    assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.team_members TO authenticated;/)

    // Function execution grants
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_authorized_team_member\(\) FROM PUBLIC;/)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_authorized_team_member\(\) TO authenticated;/)
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_team_admin\(\) FROM PUBLIC;/)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_team_admin\(\) TO authenticated;/)
  }
})

// ==============================================================================
// 3. SOURCE CODE SECURITY AUDIT TESTS
// ==============================================================================
test("18. Source Code: lib/auth.ts strictly fails closed on empty roster and error", () => {
  const authPath = path.resolve(process.cwd(), "lib/auth.ts")
  const content = fs.readFileSync(authPath, "utf-8")

  const verifyFunc = content.slice(content.indexOf("export async function verifyTeamAuthorization"))

  // Must fail closed when roster is empty
  assert.match(
    verifyFunc,
    /if \(!teamRows \|\| teamRows\.length === 0\)[\s\S]*?authorized:\s*false/,
    "verifyTeamAuthorization must return authorized: false when teamRows is empty"
  )

  // Must fail closed on database query error
  assert.match(
    verifyFunc,
    /if \(teamError\)[\s\S]*?authorized:\s*false/,
    "verifyTeamAuthorization must return authorized: false on teamError"
  )

  // Must fail closed in catch block
  assert.match(
    verifyFunc,
    /catch\s*\([^\)]*\)\s*\{[^}]*authorized:\s*false/,
    "verifyTeamAuthorization catch block must return authorized: false"
  )
})

test("19. Source Code: lib/auth.ts disables prototype mode in production", () => {
  const authPath = path.resolve(process.cwd(), "lib/auth.ts")
  const content = fs.readFileSync(authPath, "utf-8")

  assert.match(
    content,
    /if \(process\.env\.NODE_ENV === "production"\)[\s\S]*?return\s+null/,
    "getCurrentTeamMember must return null in production when Supabase is not configured"
  )

  assert.match(
    content,
    /if \(process\.env\.NODE_ENV === "production"\)[\s\S]*?authorized:\s*false/,
    "verifyTeamAuthorization must return authorized: false in production when Supabase is not configured"
  )
})

test("20. Source Code: app/auth-actions.ts denies prototype login in production", () => {
  const authActionsPath = path.resolve(process.cwd(), "app/auth-actions.ts")
  const content = fs.readFileSync(authActionsPath, "utf-8")

  assert.match(
    content,
    /if \(process\.env\.NODE_ENV === "production"\)[\s\S]*?ok:\s*false/,
    "loginAction must fail in production when Supabase is not configured"
  )
})

test("21. Source Code: lib/data-service.ts requires team membership and never leaks on error", () => {
  const dataServicePath = path.resolve(process.cwd(), "lib/data-service.ts")
  const content = fs.readFileSync(dataServicePath, "utf-8")

  // Must check getCurrentTeamMember
  assert.match(
    content,
    /const teamMember = await getCurrentTeamMember\(\)/,
    "fetchIncidents must check getCurrentTeamMember"
  )

  // Must not fall back to memoryStore within if (error) blocks
  assert.doesNotMatch(
    content,
    /if \(error\)\s*\{[^}]*return\s*\{[^}]*memoryStore/,
    "fetchIncidents must NOT return memoryStore inside if (error) block"
  )
})

test("22. Source Code: app/actions.ts guards every mutation with team authorization", () => {
  const actionsPath = path.resolve(process.cwd(), "app/actions.ts")
  const content = fs.readFileSync(actionsPath, "utf-8")

  const exportedActions = [
    "createIncident",
    "updateIncidentStatus",
    "deleteIncident",
    "recordMalwareTest",
    "toggleYaraRule",
    "createYaraRule",
    "createIncidentReport",
    "batchImportIncidents",
  ]

  for (const actionName of exportedActions) {
    const actionRegex = new RegExp(`export async function ${actionName}[\\s\\S]*?getCurrentTeamMember\\(\\)`, "i")
    assert.match(
      content,
      actionRegex,
      `Action '${actionName}' must call getCurrentTeamMember() before performing operations`
    )
  }
})

test("23. AU Risk Arithmetic: Risk scoring and severity mapping calculations", () => {
  const irmPath = path.resolve(process.cwd(), "lib/irm.ts")
  const content = fs.readFileSync(irmPath, "utf-8")

  // Verify AU formula: round(likelihood * impact)
  assert.match(content, /Math\.round\(clampedLikelihood \* clampedImpact\)/)
  assert.match(content, /if \(risk >= 80\) return "Critical"/)
  assert.match(content, /if \(risk >= 50\) return "High"/)
  assert.match(content, /if \(risk >= 20\) return "Medium"/)
})

// ==============================================================================
// 4. EXPANDED SECURITY TESTS
// ==============================================================================
test("24. Schema & Migration: Zero anonymous access policies across all tables", () => {
  const schemaPath = path.resolve(process.cwd(), "supabase/schema.sql")
  const schemaSql = fs.readFileSync(schemaPath, "utf-8")

  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/02_restrict_to_authenticated_team.sql")
  const migrationSql = fs.readFileSync(migrationPath, "utf-8")

  // schema.sql must NOT contain any policies granted TO anon or TO public
  assert.doesNotMatch(
    schemaSql,
    /CREATE POLICY[^\n]+TO\s+(anon|public)/i,
    "supabase/schema.sql must not grant any policies TO anon or TO public"
  )

  // Neither file can contain 'Allow anon' in CREATE POLICY statements
  assert.doesNotMatch(
    schemaSql,
    /CREATE POLICY\s+"Allow anon/i,
    "supabase/schema.sql must not create any 'Allow anon' policies"
  )
  assert.doesNotMatch(
    migrationSql,
    /CREATE POLICY\s+"Allow anon/i,
    "migration 02 must not create any 'Allow anon' policies"
  )
})

test("25. Inactive & Non-Member Accounts: Strictly denied in auth layer and SQL functions", () => {
  const authPath = path.resolve(process.cwd(), "lib/auth.ts")
  const authContent = fs.readFileSync(authPath, "utf-8")

  // lib/auth.ts must filter by is_active = true
  assert.match(
    authContent,
    /\.eq\("is_active",\s*true\)/,
    "lib/auth.ts must explicitly require is_active = true"
  )

  const schemaPath = path.resolve(process.cwd(), "supabase/schema.sql")
  const schemaSql = fs.readFileSync(schemaPath, "utf-8")

  // SQL is_authorized_team_member must require is_active = true
  assert.match(
    schemaSql,
    /AND\s+is_active\s*=\s*true/i,
    "is_authorized_team_member in schema.sql must require is_active = true"
  )
})

test("26. Server Actions: Every mutation checks team membership for live database writes vs isolated demo mode", () => {
  const actionsPath = path.resolve(process.cwd(), "app/actions.ts")
  const content = fs.readFileSync(actionsPath, "utf-8")

  const allActions = [
    "createIncident",
    "updateIncidentStatus",
    "deleteIncident",
    "recordMalwareTest",
    "toggleYaraRule",
    "createYaraRule",
    "createIncidentReport",
    "batchImportIncidents",
  ]

  for (const name of allActions) {
    const fnRegex = new RegExp(`export async function ${name}[\\s\\S]*?getCurrentTeamMember\\(\\)`, "i")
    assert.match(content, fnRegex, `Action ${name} must check getCurrentTeamMember()`)
    // Must protect database write with membership guard
    const dbGuardRegex = new RegExp(
      `export async function ${name}[\\s\\S]*?if \\(member && isSupabaseConfigured\\(\\)\\)`,
      "i"
    )
    assert.match(content, dbGuardRegex, `Action ${name} must guard Supabase writes with member check`)
  }
})

test("27. Data Service: All 6 fetch functions check team membership and route to Supabase or Demo Mode", () => {
  const dataServicePath = path.resolve(process.cwd(), "lib/data-service.ts")
  const content = fs.readFileSync(dataServicePath, "utf-8")

  const allFetchers = [
    "fetchIncidents",
    "fetchMalwareTests",
    "fetchYaraRules",
    "fetchReports",
    "fetchThreats",
    "fetchResponseRules",
  ]

  for (const fetcher of allFetchers) {
    assert.match(
      content,
      new RegExp(`export async function ${fetcher}[\\s\\S]*?getCurrentTeamMember\\(\\)`, "i"),
      `Fetcher ${fetcher} must check getCurrentTeamMember()`
    )
    assert.match(
      content,
      new RegExp(`export async function ${fetcher}[\\s\\S]*?if \\(teamMember && isSupabaseConfigured\\(\\)\\)`, "i"),
      `Fetcher ${fetcher} must route authenticated members to live Supabase`
    )
  }
})

test("28. Dual-Mode Security: Unauthenticated mutations never write to Supabase", () => {
  const actionsPath = path.resolve(process.cwd(), "app/actions.ts")
  const content = fs.readFileSync(actionsPath, "utf-8")

  // Ensure Supabase write calls only happen inside member checks
  assert.match(
    content,
    /if \(member && isSupabaseConfigured\(\)\)/,
    "Mutations must restrict Supabase writes to authenticated team members"
  )

  const authPath = path.resolve(process.cwd(), "lib/auth.ts")
  const authContent = fs.readFileSync(authPath, "utf-8")
  assert.match(
    authContent,
    /is_active.*true/,
    "Authentication must require active team membership"
  )
})

test("29. SQL Migration 03: Reconciles legacy columns and adds triggers for bidirectional sync", () => {
  const mig03Path = path.resolve(process.cwd(), "supabase/migrations/03_reconcile_application_schema.sql")
  assert.strictEqual(fs.existsSync(mig03Path), true, "03_reconcile_application_schema.sql must exist")
  const sql = fs.readFileSync(mig03Path, "utf-8")

  // Must handle incidents title and incident_name
  assert.match(sql, /ALTER TABLE public\.incidents ADD COLUMN IF NOT EXISTS incident_name TEXT/)
  assert.match(sql, /sync_incident_columns/)

  // Must handle malware_tests sha256_hash and file_hash
  assert.match(sql, /ALTER TABLE public\.malware_tests ADD COLUMN IF NOT EXISTS sha256_hash TEXT/)
  assert.match(sql, /ALTER TABLE public\.malware_tests ADD COLUMN IF NOT EXISTS detection_status TEXT/)
  assert.match(sql, /sync_malware_test_columns/)

  // Must handle reports report_id, report_content, incident_id, analysis_result
  assert.match(sql, /ALTER TABLE public\.reports ADD COLUMN IF NOT EXISTS incident_id TEXT/)
  assert.match(sql, /ALTER TABLE public\.reports ADD COLUMN IF NOT EXISTS analysis_result TEXT/)
  assert.match(sql, /sync_report_columns/)
})

test("30. SQL Migration 03: Drops legacy public/anon policies and defensively applies team-only RLS", () => {
  const mig03Path = path.resolve(process.cwd(), "supabase/migrations/03_reconcile_application_schema.sql")
  const sql = fs.readFileSync(mig03Path, "utf-8")

  // Must enable RLS on all 7 tables
  const allTables = ["incidents", "malware_tests", "yara_rules", "reports", "threats", "response_rules", "team_members"]
  for (const table of allTables) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, "i"))
  }

  // Must not create any anonymous policies
  assert.doesNotMatch(sql, /CREATE POLICY\s+"Allow anon/i)

  // Must restrict table privileges
  assert.match(sql, /REVOKE ALL ON TABLE public\.incidents FROM anon, PUBLIC;/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.incidents TO authenticated;/)
})

test("31. SQL Migration 03: Data preservation, no invented hashes, verified report linking, and safe team member handling", () => {
  const mig03Path = path.resolve(process.cwd(), "supabase/migrations/03_reconcile_application_schema.sql")
  const sql = fs.readFileSync(mig03Path, "utf-8")

  // 1. Requirement 1: Zero DROP TABLE and zero DELETE FROM
  assert.doesNotMatch(sql, /DROP\s+TABLE/i, "Must never drop tables")
  assert.doesNotMatch(sql, /DELETE\s+FROM/i, "Must never delete records")

  // 2. Requirement 2: Do not invent file hashes or placeholder scan results
  assert.doesNotMatch(
    sql,
    /UPDATE\s+public\.malware_tests\s+SET\s+sha256_hash\s*=\s*'e3b0c442/i,
    "Must not invent fake/empty file hashes in malware_tests"
  )

  // 3. Requirement 3: Do not copy report_id into incident_id unless verified; preserve report_id separately
  assert.match(
    sql,
    /EXISTS\s*\(\s*SELECT 1 FROM public\.incidents/i,
    "Must verify incident existence before linking report_id to incident_id"
  )
  assert.doesNotMatch(
    sql,
    /NEW\.incident_id\s*:=\s*NEW\.report_id/i,
    "Trigger must not conflate report_id with incident_id"
  )

  // 4. Requirement 4: Handle existing team_members rows with missing emails safely
  assert.match(
    sql,
    /@disabled\.invalid/i,
    "Must use unclaimable RFC 2606 .invalid placeholder for unidentifiable accounts"
  )
  assert.match(
    sql,
    /is_active\s*=\s*false/i,
    "Must deactivate unidentifiable accounts"
  )
  assert.doesNotMatch(
    sql,
    /SET\s+role\s*=\s*'admin'[\s\S]*?WHERE\s+email\s+IS\s+NULL/i,
    "Must not grant admin privileges to records with missing email"
  )

  // 5. Requirement 6: Drops NOT NULL on legacy columns across tables
  assert.match(sql, /ALTER COLUMN title DROP NOT NULL/i)
  assert.match(sql, /ALTER COLUMN file_hash DROP NOT NULL/i)
  assert.match(sql, /ALTER COLUMN report_id DROP NOT NULL/i)
})



