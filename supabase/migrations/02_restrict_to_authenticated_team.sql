-- ==============================================================================
-- Migration: 02_restrict_to_authenticated_team.sql
-- Purpose: Remove anonymous access and fail-open bootstrap logic. Restrict all
--          database operations to authenticated, active, explicitly authorized
--          IRM project team members.
-- Execution: Run manually in the Supabase Dashboard SQL Editor (service_role/postgres).
--
-- EXECUTION ORDER & PREREQUISITES:
-- 1. On a fresh database, 01_initial_schema.sql (or supabase/schema.sql) MUST be
--    executed FIRST to establish base tables (incidents, malware_tests, yara_rules,
--    reports, threats, response_rules).
-- 2. Execute 02_restrict_to_authenticated_team.sql SECOND.
-- 3. This migration is idempotent and safe to re-run after initial configuration.
--    It cannot initialize an empty database from scratch because DROP POLICY
--    requires existing relations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP ALL PREVIOUS ANONYMOUS ACCESS POLICIES
-- ------------------------------------------------------------------------------

-- Incidents
DROP POLICY IF EXISTS "Allow anon all on incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow anon select on incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow anon insert on incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow anon update on incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow anon delete on incidents" ON public.incidents;

-- Malware Tests
DROP POLICY IF EXISTS "Allow anon all on malware_tests" ON public.malware_tests;
DROP POLICY IF EXISTS "Allow anon select on malware_tests" ON public.malware_tests;
DROP POLICY IF EXISTS "Allow anon insert on malware_tests" ON public.malware_tests;
DROP POLICY IF EXISTS "Allow anon update on malware_tests" ON public.malware_tests;
DROP POLICY IF EXISTS "Allow anon delete on malware_tests" ON public.malware_tests;

-- YARA Rules
DROP POLICY IF EXISTS "Allow anon all on yara_rules" ON public.yara_rules;
DROP POLICY IF EXISTS "Allow anon select on yara_rules" ON public.yara_rules;
DROP POLICY IF EXISTS "Allow anon insert on yara_rules" ON public.yara_rules;
DROP POLICY IF EXISTS "Allow anon update on yara_rules" ON public.yara_rules;
DROP POLICY IF EXISTS "Allow anon delete on yara_rules" ON public.yara_rules;

-- Incident Reports
DROP POLICY IF EXISTS "Allow anon all on reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon select on reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon insert on reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon update on reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon delete on reports" ON public.reports;

-- Threat Intelligence
DROP POLICY IF EXISTS "Allow anon all on threats" ON public.threats;
DROP POLICY IF EXISTS "Allow anon select on threats" ON public.threats;
DROP POLICY IF EXISTS "Allow anon insert on threats" ON public.threats;
DROP POLICY IF EXISTS "Allow anon update on threats" ON public.threats;
DROP POLICY IF EXISTS "Allow anon delete on threats" ON public.threats;

-- Response Rules
DROP POLICY IF EXISTS "Allow anon all on response_rules" ON public.response_rules;
DROP POLICY IF EXISTS "Allow anon select on response_rules" ON public.response_rules;
DROP POLICY IF EXISTS "Allow anon insert on response_rules" ON public.response_rules;
DROP POLICY IF EXISTS "Allow anon update on response_rules" ON public.response_rules;
DROP POLICY IF EXISTS "Allow anon delete on response_rules" ON public.response_rules;

-- Dynamic Catalog Cleanup: Safely discover and drop ANY remaining policies granting access to anon or public
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('incidents', 'malware_tests', 'yara_rules', 'reports', 'threats', 'response_rules', 'team_members')
          AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Dropped legacy public/anon policy "%" on %.%', pol.policyname, pol.schemaname, pol.tablename;
    END LOOP;
END $$;



-- ------------------------------------------------------------------------------
-- 2. ENSURE TEAM MEMBERS ROSTER TABLE EXISTS & RECONCILE STRUCTURE
-- ------------------------------------------------------------------------------

-- Step 2a: Create table if it does not already exist
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'SecOps Analyst',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Step 2b: Defensive column reconciliation for pre-existing tables
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'SecOps Analyst';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Step 2c: Defensive verification of PRIMARY KEY constraint on id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.team_members'::regclass
        AND contype = 'p'
    ) THEN
        IF EXISTS (SELECT 1 FROM public.team_members WHERE id IS NULL) THEN
            RAISE EXCEPTION 'Migration halted: public.team_members contains NULL values in column "id". Populate unique UUIDs before establishing PRIMARY KEY. Query: SELECT count(*) FROM public.team_members WHERE id IS NULL;';
        END IF;

        IF (SELECT count(*) - count(distinct id) FROM public.team_members) > 0 THEN
            RAISE EXCEPTION 'Migration halted: public.team_members contains duplicate values in column "id". Resolve duplicate IDs before establishing PRIMARY KEY. Query: SELECT id, count(*) FROM public.team_members GROUP BY id HAVING count(*) > 1;';
        END IF;

        ALTER TABLE public.team_members ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Step 2d: Defensive verification of FOREIGN KEY constraint on user_id referencing auth.users(id)
DO $$
DECLARE
    v_has_fk BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.team_members'::regclass
          AND c.contype = 'f'
          AND c.confrelid = 'auth.users'::regclass
          AND a.attname = 'user_id'
    ) INTO v_has_fk;

    IF NOT v_has_fk THEN
        -- Check for orphaned user_id values
        IF EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tm.user_id)
        ) THEN
            RAISE EXCEPTION 'Migration halted: public.team_members contains user_id values not present in auth.users. Clean up orphaned user_id values before applying foreign key constraint. Diagnostic query: SELECT tm.id, tm.user_id, tm.email FROM public.team_members tm WHERE tm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tm.user_id);';
        END IF;

        ALTER TABLE public.team_members
        ADD CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2e: Defensive verification of NOT NULL constraint on email
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'team_members' 
          AND column_name = 'email' 
          AND is_nullable = 'YES'
    ) THEN
        IF EXISTS (SELECT 1 FROM public.team_members WHERE email IS NULL) THEN
            RAISE EXCEPTION 'Migration halted: public.team_members contains rows with NULL email. Populate valid email addresses before enforcing NOT NULL. Query: SELECT id FROM public.team_members WHERE email IS NULL;';
        END IF;
        ALTER TABLE public.team_members ALTER COLUMN email SET NOT NULL;
    END IF;
END $$;

-- Step 2f: Defensive detection of case-insensitive duplicate emails and creation of unique lower(email) index
DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    -- Detect case-insensitive duplicates
    SELECT count(*) - count(distinct lower(email))
    INTO v_dup_count
    FROM public.team_members
    WHERE email IS NOT NULL;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Migration halted: public.team_members contains % case-insensitive duplicate email record(s). Resolve case collisions before applying migration 02. Diagnostic query: SELECT lower(email), count(*) FROM public.team_members GROUP BY lower(email) HAVING count(*) > 1;', v_dup_count;
    END IF;

    -- Create unique index on lower(email) if it does not already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE i.indrelid = 'public.team_members'::regclass
          AND i.indisunique = true
          AND pg_get_indexdef(i.indexrelid) ILIKE '%lower(email)%'
    ) THEN
        CREATE UNIQUE INDEX team_members_lower_email_idx ON public.team_members (lower(email));
    END IF;
END $$;

-- Step 2g: Reconcile role, is_active, and created_at columns (defaults and NOT NULL)
DO $$
BEGIN
    UPDATE public.team_members SET role = 'SecOps Analyst' WHERE role IS NULL;
    ALTER TABLE public.team_members ALTER COLUMN role SET NOT NULL;
    ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'SecOps Analyst';

    UPDATE public.team_members SET is_active = true WHERE is_active IS NULL;
    ALTER TABLE public.team_members ALTER COLUMN is_active SET NOT NULL;
    ALTER TABLE public.team_members ALTER COLUMN is_active SET DEFAULT true;

    UPDATE public.team_members SET created_at = timezone('utc'::text, now()) WHERE created_at IS NULL;
    ALTER TABLE public.team_members ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.team_members ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
END $$;




-- ------------------------------------------------------------------------------
-- 3. DEFENSIVELY RE-ENABLE ROW LEVEL SECURITY ON ALL SEVEN TABLES
-- ------------------------------------------------------------------------------
-- Explicitly ensure RLS is active on every application table before configuring policies:

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malware_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yara_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 4. HARDENED SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ------------------------------------------------------------------------------

-- Helper 1: Verify active team membership (Fail-Closed: NEVER authorizes if roster is empty)
CREATE OR REPLACE FUNCTION public.is_authorized_team_member()
RETURNS BOOLEAN AS $$
BEGIN
    -- Fail-closed: Must have valid authenticated user id
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
-- 4b. EXPLICIT TABLE PRIVILEGES (DEFENSE-IN-DEPTH)
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
-- 5. RESTRICT INCIDENTS TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on incidents" ON public.incidents;
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


-- ------------------------------------------------------------------------------
-- 6. RESTRICT MALWARE TESTS TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on malware_tests" ON public.malware_tests;
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


-- ------------------------------------------------------------------------------
-- 7. RESTRICT YARA RULES TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on yara_rules" ON public.yara_rules;
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


-- ------------------------------------------------------------------------------
-- 8. RESTRICT INCIDENT REPORTS TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on reports" ON public.reports;
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


-- ------------------------------------------------------------------------------
-- 9. RESTRICT THREAT INTELLIGENCE TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on threats" ON public.threats;
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


-- ------------------------------------------------------------------------------
-- 10. RESTRICT RESPONSE RULES TABLE TO AUTHORIZED TEAM MEMBERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated team members all on response_rules" ON public.response_rules;
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


-- ------------------------------------------------------------------------------
-- 11. RESTRICT TEAM MEMBERS TABLE (NO PUBLIC ENUMERATION)
-- ------------------------------------------------------------------------------

-- Drop all old policies
DROP POLICY IF EXISTS "Allow anon all on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon select on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon insert on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon update on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon delete on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow authenticated team members all on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow authenticated team members view roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow authenticated team members manage roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow active team members view roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins manage roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins insert roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins update roster" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins delete roster" ON public.team_members;

-- Only active, authorized team members can view the roster (prevents unauthorized user enumeration)
CREATE POLICY "Allow active team members view roster"
    ON public.team_members FOR SELECT TO authenticated
    USING (public.is_authorized_team_member());

-- Only designated team administrators can modify roster entries
CREATE POLICY "Allow team admins insert roster"
    ON public.team_members FOR INSERT TO authenticated
    WITH CHECK (public.is_team_admin());

CREATE POLICY "Allow team admins update roster"
    ON public.team_members FOR UPDATE TO authenticated
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

CREATE POLICY "Allow team admins delete roster"
    ON public.team_members FOR DELETE TO authenticated
    USING (public.is_team_admin());

-- Note: Anonymous role (anon) has zero policies. All unauthenticated requests are denied.

-- ==============================================================================
-- SAFE ADMINISTRATOR PROVISIONING INSTRUCTIONS
-- ==============================================================================
-- Because bootstrap fallback is eliminated for fail-closed security, the initial
-- administrator must be provisioned via the Supabase Dashboard SQL Editor
-- (which runs with superuser / service_role privileges, bypassing RLS).
--
-- PREREQUISITE:
-- 1. Create the user in Supabase Auth first:
--    Dashboard -> Authentication -> Users -> "Add User" / "Create User"
--    Enter the team administrator's email and password, and check "Auto Confirm User".
--
-- ------------------------------------------------------------------------------
-- METHOD 1 (RECOMMENDED): Fail-Safe PL/pgSQL Verification & Provisioning Block
-- ------------------------------------------------------------------------------
-- Validates that:
-- - Exactly one matching Auth user exists in auth.users
-- - The Auth user's email is confirmed (email_confirmed_at IS NOT NULL)
-- - Does NOT silently promote existing ordinary analysts (requires explicit promotion)
-- - Does NOT silently reassign user_id if already bound to another Auth user
-- - Does NOT silently reactivate inactive accounts
-- - Idempotent: reports notice without modifying state if already properly configured
--
-- Replace 'admin@yourcompany.com' below with your administrator's actual email:
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
--
-- ------------------------------------------------------------------------------
-- METHOD 2: Single Statement Alternative (Using Conflict Target ((lower(email))))
-- ------------------------------------------------------------------------------
-- Uses conflict target ((lower(email))) matching team_members_lower_email_idx.
-- Note: Method 1 (PL/pgSQL above) is recommended because it produces clear,
-- descriptive diagnostic errors rather than silently skipping conflicting rows.
--
-- INSERT INTO public.team_members (user_id, email, role, is_active)
-- SELECT id, email, 'Incident Lead Responder', true
-- FROM auth.users
-- WHERE lower(email) = lower('admin@yourcompany.com')
--   AND (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
-- ON CONFLICT ((lower(email))) DO UPDATE 
-- SET user_id = EXCLUDED.user_id
-- WHERE public.team_members.user_id IS NULL
--   AND public.team_members.is_active = true
--   AND lower(public.team_members.role) IN ('admin', 'secops admin', 'incident lead responder', 'lead');
--
-- ------------------------------------------------------------------------------
-- EXPLICIT PROMOTION OF AN EXISTING TEAM MEMBER
-- ------------------------------------------------------------------------------
-- If an account was previously added as an ordinary analyst, promotion must be explicit:
--
-- UPDATE public.team_members
-- SET role = 'Incident Lead Responder',
--     user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('analyst@yourcompany.com')),
--     is_active = true
-- WHERE lower(email) = lower('analyst@yourcompany.com');
--
-- ------------------------------------------------------------------------------
-- VERIFICATION QUERY
-- ------------------------------------------------------------------------------
-- Confirm that the roster record exists, is active, confirmed, and links to Auth UUID:
--
-- SELECT tm.id, tm.user_id, tm.email, tm.role, tm.is_active, 
--        u.email AS auth_email, u.email_confirmed_at
-- FROM public.team_members tm
-- LEFT JOIN auth.users u ON u.id = tm.user_id
-- WHERE lower(tm.email) = lower('admin@yourcompany.com');
-- ==============================================================================

