-- ==============================================================================
-- Incident Response Module (IRM) — Consolidated Production Database Schema
-- Architecture: Arithmetic Unit (AU) -> Incident Response Module (IRM) -> Graphical Unit (GU)
-- Access Model: Strictly restricted to active, authenticated team members (Fail-Closed)
-- Execution: Run in Supabase SQL Editor (as postgres/service_role) to initialize a fresh database.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APPLICATION TABLES
-- ------------------------------------------------------------------------------

-- 1. Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT UNIQUE NOT NULL,
    incident_name TEXT NOT NULL,
    description TEXT,
    likelihood NUMERIC(3, 2) NOT NULL DEFAULT 0.50 CHECK (likelihood >= 0 AND likelihood <= 1),
    impact INTEGER NOT NULL DEFAULT 50 CHECK (impact >= 0 AND impact <= 100),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Investigating', 'Resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Malware Tests Table
CREATE TABLE IF NOT EXISTS public.malware_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_hash TEXT NOT NULL,
    detection_status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    scanner_type TEXT NOT NULL,
    scan_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. YARA Rules Table
CREATE TABLE IF NOT EXISTS public.yara_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT UNIQUE NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    rule_content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Incident Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL,
    report_title TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    analysis_result TEXT NOT NULL,
    response_notes TEXT NOT NULL,
    generated_by TEXT DEFAULT 'SecOps Analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Threats Intelligence Table
CREATE TABLE IF NOT EXISTS public.threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_name TEXT NOT NULL,
    threat_type TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('Critical', 'High', 'Medium', 'Low')),
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. AU Response Rules Table
CREATE TABLE IF NOT EXISTS public.response_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT UNIQUE NOT NULL,
    rule_name TEXT NOT NULL,
    condition TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Team Members Roster Table
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'SecOps Analyst',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Case-insensitive unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS team_members_lower_email_idx ON public.team_members (lower(email));


-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ------------------------------------------------------------------------------
-- Explicitly activate Row Level Security on all 7 tables:
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malware_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yara_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. HARDENED SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ------------------------------------------------------------------------------

-- Helper 1: Verify active team membership (Fail-Closed: NEVER authorizes if roster is empty)
CREATE OR REPLACE FUNCTION public.is_authorized_team_member()
RETURNS BOOLEAN AS $$
BEGIN
    -- Fail-closed: Must have valid authenticated user ID
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Strictly requires an existing, active roster record
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE (
            user_id = auth.uid() 
            OR lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.is_authorized_team_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_team_member() TO authenticated;


-- Helper 2: Verify team administrative privileges (to manage roster)
CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE (
            user_id = auth.uid() 
            OR lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
        AND is_active = true
        AND lower(role) IN ('admin', 'secops admin', 'incident lead responder', 'lead')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.is_team_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_admin() TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. EXPLICIT TABLE PRIVILEGES (DEFENSE-IN-DEPTH)
-- ------------------------------------------------------------------------------
-- Explicitly revoke all table-level access from anon and PUBLIC.
-- Unauthenticated requests via Supabase API (PostgREST) are immediately rejected.
REVOKE ALL ON TABLE public.incidents FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.malware_tests FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.yara_rules FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.reports FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.threats FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.response_rules FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.team_members FROM anon, PUBLIC;

-- Explicitly grant table permissions to authenticated role (strictly filtered by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.malware_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yara_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.threats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.response_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_members TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY POLICIES (TEAM-ONLY ACCESS)
-- ------------------------------------------------------------------------------

-- Incidents
DROP POLICY IF EXISTS "Allow authenticated team members select on incidents" ON public.incidents;
CREATE POLICY "Allow authenticated team members select on incidents"
    ON public.incidents FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on incidents" ON public.incidents;
CREATE POLICY "Allow authenticated team members insert on incidents"
    ON public.incidents FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on incidents" ON public.incidents;
CREATE POLICY "Allow authenticated team members update on incidents"
    ON public.incidents FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on incidents" ON public.incidents;
CREATE POLICY "Allow authenticated team members delete on incidents"
    ON public.incidents FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- Malware Tests
DROP POLICY IF EXISTS "Allow authenticated team members select on malware_tests" ON public.malware_tests;
CREATE POLICY "Allow authenticated team members select on malware_tests"
    ON public.malware_tests FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on malware_tests" ON public.malware_tests;
CREATE POLICY "Allow authenticated team members insert on malware_tests"
    ON public.malware_tests FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on malware_tests" ON public.malware_tests;
CREATE POLICY "Allow authenticated team members update on malware_tests"
    ON public.malware_tests FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on malware_tests" ON public.malware_tests;
CREATE POLICY "Allow authenticated team members delete on malware_tests"
    ON public.malware_tests FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- YARA Rules
DROP POLICY IF EXISTS "Allow authenticated team members select on yara_rules" ON public.yara_rules;
CREATE POLICY "Allow authenticated team members select on yara_rules"
    ON public.yara_rules FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on yara_rules" ON public.yara_rules;
CREATE POLICY "Allow authenticated team members insert on yara_rules"
    ON public.yara_rules FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on yara_rules" ON public.yara_rules;
CREATE POLICY "Allow authenticated team members update on yara_rules"
    ON public.yara_rules FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on yara_rules" ON public.yara_rules;
CREATE POLICY "Allow authenticated team members delete on yara_rules"
    ON public.yara_rules FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- Incident Reports
DROP POLICY IF EXISTS "Allow authenticated team members select on reports" ON public.reports;
CREATE POLICY "Allow authenticated team members select on reports"
    ON public.reports FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on reports" ON public.reports;
CREATE POLICY "Allow authenticated team members insert on reports"
    ON public.reports FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on reports" ON public.reports;
CREATE POLICY "Allow authenticated team members update on reports"
    ON public.reports FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on reports" ON public.reports;
CREATE POLICY "Allow authenticated team members delete on reports"
    ON public.reports FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- Threat Intelligence
DROP POLICY IF EXISTS "Allow authenticated team members select on threats" ON public.threats;
CREATE POLICY "Allow authenticated team members select on threats"
    ON public.threats FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on threats" ON public.threats;
CREATE POLICY "Allow authenticated team members insert on threats"
    ON public.threats FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on threats" ON public.threats;
CREATE POLICY "Allow authenticated team members update on threats"
    ON public.threats FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on threats" ON public.threats;
CREATE POLICY "Allow authenticated team members delete on threats"
    ON public.threats FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- Response Rules
DROP POLICY IF EXISTS "Allow authenticated team members select on response_rules" ON public.response_rules;
CREATE POLICY "Allow authenticated team members select on response_rules"
    ON public.response_rules FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members insert on response_rules" ON public.response_rules;
CREATE POLICY "Allow authenticated team members insert on response_rules"
    ON public.response_rules FOR INSERT TO authenticated
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members update on response_rules" ON public.response_rules;
CREATE POLICY "Allow authenticated team members update on response_rules"
    ON public.response_rules FOR UPDATE TO authenticated
    USING (public.is_authorized_team_member())
    WITH CHECK (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow authenticated team members delete on response_rules" ON public.response_rules;
CREATE POLICY "Allow authenticated team members delete on response_rules"
    ON public.response_rules FOR DELETE TO authenticated
    USING (public.is_authorized_team_member());

-- Team Members Roster (No Public Enumeration)
DROP POLICY IF EXISTS "Allow active team members view roster" ON public.team_members;
CREATE POLICY "Allow active team members view roster"
    ON public.team_members FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

DROP POLICY IF EXISTS "Allow team admins insert roster" ON public.team_members;
CREATE POLICY "Allow team admins insert roster"
    ON public.team_members FOR INSERT TO authenticated
    WITH CHECK (public.is_team_admin());

DROP POLICY IF EXISTS "Allow team admins update roster" ON public.team_members;
CREATE POLICY "Allow team admins update roster"
    ON public.team_members FOR UPDATE TO authenticated
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

DROP POLICY IF EXISTS "Allow team admins delete roster" ON public.team_members;
CREATE POLICY "Allow team admins delete roster"
    ON public.team_members FOR DELETE TO authenticated
    USING (public.is_team_admin());

-- Note: Anonymous role (anon) has zero policies. All unauthenticated requests are denied by default.
--
-- Demonstration Seed Data:
-- Baseline evaluation records are stored in supabase/seed.sql.
-- To populate sample incidents, YARA rules, and telemetry, run supabase/seed.sql after this schema.
--
-- ==============================================================================
-- 6. INITIAL ADMINISTRATOR PROVISIONING PROCEDURE (FAIL-CLOSED)
-- ==============================================================================
-- Because the application fails closed when public.team_members is empty, the initial
-- administrator must be provisioned via the Supabase Dashboard SQL Editor (running as postgres).
--
-- PREREQUISITE:
-- 1. Create the administrator account in Supabase Dashboard -> Authentication -> Users.
-- 2. Ensure "Auto Confirm User" is enabled (or confirm the email).
-- 3. Replace 'admin@yourcompany.com' below with your actual administrator email.
--
-- SECURITY GUARDS IN THIS SCRIPT:
-- - Validates exactly one confirmed Auth account exists.
-- - Prevents silent account reassignment (stops if user_id is already bound to a different Auth ID).
-- - Prevents silent reactivation (stops if account exists but is_active = false).
-- - Prevents silent role elevation (stops if account exists with an ordinary analyst role).
-- - Idempotent: Safe to rerun if already properly configured.
--
-- DO $$
-- DECLARE
--     v_admin_email CONSTANT TEXT := lower('admin@yourcompany.com');
--     v_user_count INTEGER;
--     v_auth_id UUID;
--     v_is_confirmed BOOLEAN;
--     v_existing_id UUID;
--     v_existing_user_id UUID;
--     v_existing_role TEXT;
--     v_existing_is_active BOOLEAN;
-- BEGIN
--     -- 1. Check matching accounts in auth.users
--     SELECT count(*)
--     INTO v_user_count
--     FROM auth.users
--     WHERE lower(email) = v_admin_email;
--
--     IF v_user_count = 0 THEN
--         RAISE EXCEPTION 'Provisioning halted: No account found in auth.users for email "%". Please create the user in Supabase Dashboard -> Authentication -> Users first.', v_admin_email;
--     ELSIF v_user_count > 1 THEN
--         RAISE EXCEPTION 'Provisioning halted: Multiple accounts found in auth.users for email "%" (case-insensitive collision). Resolve duplicate auth accounts before proceeding.', v_admin_email;
--     END IF;
--
--     -- 2. Verify confirmed email and retrieve Auth UUID via separate query (avoiding aggregates on uuid)
--     SELECT id, (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
--     INTO v_auth_id, v_is_confirmed
--     FROM auth.users
--     WHERE lower(email) = v_admin_email;
--
--     IF NOT coalesce(v_is_confirmed, false) THEN
--         RAISE EXCEPTION 'Provisioning halted: Account "%" has not confirmed their email (email_confirmed_at is NULL). In Supabase Dashboard -> Authentication -> Users, check "Auto Confirm User" or confirm the email.', v_admin_email;
--     END IF;
--
--     -- 3. Check existing membership in public.team_members
--     SELECT id, user_id, role, is_active
--     INTO v_existing_id, v_existing_user_id, v_existing_role, v_existing_is_active
--     FROM public.team_members
--     WHERE lower(email) = v_admin_email;
--
--     IF v_existing_id IS NOT NULL THEN
--         -- Guard 3a: Refuse silent reactivation of inactive memberships
--         IF v_existing_is_active = false THEN
--             RAISE EXCEPTION 'Provisioning halted: Team member "%" (ID: %) exists but is currently deactivated (is_active = false). The provisioning script will not silently reactivate an inactive account. Perform an intentional reactivation if intended: UPDATE public.team_members SET is_active = true WHERE id = ''%'';', v_admin_email, v_existing_id, v_existing_id;
--         END IF;
--
--         -- Guard 3b: Refuse implicit role elevation of ordinary analysts
--         IF lower(v_existing_role) NOT IN ('admin', 'secops admin', 'incident lead responder', 'lead') THEN
--             RAISE EXCEPTION 'Provisioning halted: "%" already exists as an ordinary member with role "%". Implicit elevation to administrator is forbidden. To intentionally promote this member, run explicit promotion: UPDATE public.team_members SET role = ''Incident Lead Responder'', user_id = ''%'' WHERE id = ''%'';', v_admin_email, v_existing_role, v_auth_id, v_existing_id;
--         END IF;
--
--         -- Guard 3c: Refuse silent account reassignment if already linked to a different Auth ID
--         IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> v_auth_id THEN
--             RAISE EXCEPTION 'Provisioning halted: Administrator "%" (ID: %) is already bound to Auth user ID % (different from incoming Auth ID %). Silently reassigning an existing administrator account association is forbidden. Resolve account association manually.', v_admin_email, v_existing_id, v_existing_user_id, v_auth_id;
--         END IF;
--
--         -- Guard 3d: Already properly configured and linked
--         IF v_existing_user_id = v_auth_id THEN
--             RAISE NOTICE 'Administrator membership already exists for "%" and is actively linked to Auth UUID %. No changes made.', v_admin_email, v_auth_id;
--         -- Guard 3e: Pre-existing admin with NULL user_id: safe initial association
--         ELSIF v_existing_user_id IS NULL THEN
--             UPDATE public.team_members
--             SET user_id = v_auth_id
--             WHERE id = v_existing_id;
--             RAISE NOTICE 'Successfully linked Auth UUID % to existing unlinked administrator "%" (role: "%").', v_auth_id, v_admin_email, v_existing_role;
--         END IF;
--     ELSE
--         -- 4. Insert new administrator record
--         INSERT INTO public.team_members (user_id, email, role, is_active)
--         VALUES (v_auth_id, v_admin_email, 'Incident Lead Responder', true);
--         RAISE NOTICE 'Successfully provisioned initial administrator for "%" (Auth UUID: %).', v_admin_email, v_auth_id;
--     END IF;
-- END $$;
-- ==============================================================================
