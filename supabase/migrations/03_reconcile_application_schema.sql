-- ==============================================================================
-- Incident Response Module (IRM) — Migration 03: Application & Database Reconciliation
-- Purpose:
--   1. Safely upgrade older/prototype Supabase schemas to the current application schema.
--   2. Reconcile legacy columns across all seven tables:
--      - malware_tests: file_hash, tested_at, detection_result, severity <->
--                       sha256_hash, created_at, detection_status, risk_level, scanner_type, scan_notes
--      - incidents: title <-> incident_name, risk_score, likelihood, impact
--      - reports: report_id, report_content <-> incident_id, report_title, analysis_result, response_notes
--      - response_rules: condition_query, action_taken, status <-> condition, severity, is_active
--      - threats: severity <-> risk_level, source, status, ioc_indicators
--      - yara_rules: rule_id, rule_name, rule_content, severity, is_active
--      - team_members: id, user_id, email, role, is_active, created_at
--   3. PRESERVE ALL EXISTING RECORDS (zero data loss, no table drops, no record deletions).
--   4. Never invent file hashes or placeholder scan results for malware tests.
--   5. Preserve original report_id separately; only link incident_id if verified by an existing incident.
--   6. Safely handle team_members rows with missing emails without silent assignment or admin elevation.
--   7. Drop legacy NOT NULL and unique constraints that could cause application inserts to fail.
--   8. Enforce fail-closed Row Level Security (RLS) and team authorization on all 7 tables.
--   9. Fully idempotent and safe to run multiple times.
-- Execution:
--   Run in the Supabase Dashboard SQL Editor as postgres/service_role.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENSURE ALL APPLICATION TABLES EXIST
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT UNIQUE,
    incident_name TEXT,
    title TEXT,
    description TEXT,
    likelihood NUMERIC(3, 2) DEFAULT 0.50,
    impact INTEGER DEFAULT 50,
    risk_score INTEGER,
    severity TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.malware_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT DEFAULT 'unknown_sample',
    file_size BIGINT DEFAULT 0,
    sha256_hash TEXT,
    file_hash TEXT,
    detection_status TEXT,
    detection_result TEXT,
    risk_level TEXT,
    severity TEXT,
    scanner_type TEXT DEFAULT 'Static Triage Scanner',
    scan_notes TEXT,
    tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.yara_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT UNIQUE,
    rule_name TEXT,
    description TEXT,
    severity TEXT DEFAULT 'Medium',
    rule_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT,
    incident_id TEXT,
    report_title TEXT,
    risk_score INTEGER DEFAULT 0,
    severity TEXT DEFAULT 'Medium',
    analysis_result TEXT,
    response_notes TEXT,
    report_content TEXT,
    generated_by TEXT DEFAULT 'SecOps Analyst',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_name TEXT,
    threat_type TEXT,
    risk_level TEXT DEFAULT 'Medium',
    severity TEXT,
    source TEXT DEFAULT 'External Feed',
    status TEXT DEFAULT 'Active',
    ioc_indicators TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.response_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT UNIQUE,
    rule_name TEXT,
    condition TEXT,
    condition_query TEXT,
    action_taken TEXT,
    severity TEXT DEFAULT 'Medium',
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'SecOps Analyst',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- ------------------------------------------------------------------------------
-- 2. RECONCILE INCIDENTS TABLE
-- ------------------------------------------------------------------------------

-- Ensure all expected columns exist
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS incident_id TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS incident_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS likelihood NUMERIC(3, 2) DEFAULT 0.50;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS impact INTEGER DEFAULT 50;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Medium';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on incidents(id) if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.incidents'::regclass AND contype = 'p'
    ) THEN
        UPDATE public.incidents SET id = gen_random_uuid() WHERE id IS NULL;
        ALTER TABLE public.incidents ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.incidents ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on legacy columns so modern application inserts succeed
DO $$
DECLARE
    col_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'title' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.incidents ALTER COLUMN title DROP NOT NULL;
    END IF;

    FOR col_name IN VALUES ('assigned_to'), ('created_by'), ('category'), ('reporter'), ('source')
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = col_name AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE public.incidents ALTER COLUMN %I DROP NOT NULL', col_name);
            RAISE NOTICE 'Dropped NOT NULL constraint on legacy column public.incidents.%', col_name;
        END IF;
    END LOOP;
END $$;

-- Drop legacy unique constraints on title or incident_name that could cause inserts of same-named incidents to fail
DO $$
DECLARE
    con RECORD;
BEGIN
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.incidents'::regclass
          AND c.contype = 'u'
          AND a.attname IN ('title', 'incident_name')
    LOOP
        EXECUTE format('ALTER TABLE public.incidents DROP CONSTRAINT %I', con.conname);
        RAISE NOTICE 'Dropped unique constraint % on public.incidents to prevent insert collisions', con.conname;
    END LOOP;
END $$;

-- Synchronize legacy data non-destructively
DO $$
BEGIN
    -- Synchronize between title and incident_name
    UPDATE public.incidents SET incident_name = title WHERE incident_name IS NULL AND title IS NOT NULL;
    UPDATE public.incidents SET title = incident_name WHERE title IS NULL AND incident_name IS NOT NULL;

    -- Backfill missing incident_id
    UPDATE public.incidents 
    SET incident_id = 'INC-' || substr(replace(id::text, '-', ''), 1, 8) 
    WHERE incident_id IS NULL;

    -- Backfill likelihood & impact defaults
    UPDATE public.incidents SET likelihood = 0.50 WHERE likelihood IS NULL;
    UPDATE public.incidents SET impact = 50 WHERE impact IS NULL;

    -- Compute risk_score using Arithmetic Unit formula: round(likelihood * impact)
    UPDATE public.incidents 
    SET risk_score = round(coalesce(likelihood, 0.50) * coalesce(impact, 50)) 
    WHERE risk_score IS NULL;

    -- Compute severity from risk_score
    UPDATE public.incidents 
    SET severity = CASE 
        WHEN risk_score >= 80 THEN 'Critical'
        WHEN risk_score >= 50 THEN 'High'
        WHEN risk_score >= 20 THEN 'Medium'
        ELSE 'Low'
    END
    WHERE severity IS NULL;

    -- Default status & timestamp
    UPDATE public.incidents SET status = 'Open' WHERE status IS NULL;
    UPDATE public.incidents SET created_at = timezone('utc'::text, now()) WHERE created_at IS NULL;
END $$;

-- Trigger: Ensure two-way synchronization between legacy 'title' and modern 'incident_name'
CREATE OR REPLACE FUNCTION public.sync_incident_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.incident_name IS NULL AND NEW.title IS NOT NULL THEN
        NEW.incident_name := NEW.title;
    ELSIF NEW.title IS NULL AND NEW.incident_name IS NOT NULL THEN
        NEW.title := NEW.incident_name;
    END IF;

    IF NEW.incident_id IS NULL THEN
        NEW.incident_id := 'INC-' || substr(replace(coalesce(NEW.id::text, md5(random()::text || clock_timestamp()::text)), '-', ''), 1, 8);
    END IF;

    IF NEW.risk_score IS NULL AND NEW.likelihood IS NOT NULL AND NEW.impact IS NOT NULL THEN
        NEW.risk_score := round(NEW.likelihood * NEW.impact);
    END IF;

    IF NEW.severity IS NULL AND NEW.risk_score IS NOT NULL THEN
        NEW.severity := CASE 
            WHEN NEW.risk_score >= 80 THEN 'Critical'
            WHEN NEW.risk_score >= 50 THEN 'High'
            WHEN NEW.risk_score >= 20 THEN 'Medium'
            ELSE 'Low'
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_incident_columns ON public.incidents;
CREATE TRIGGER trg_sync_incident_columns
BEFORE INSERT OR UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.sync_incident_columns();


-- ------------------------------------------------------------------------------
-- 3. RECONCILE MALWARE_TESTS TABLE
-- ------------------------------------------------------------------------------

-- Ensure all expected columns exist
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT 'unknown_sample';
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS sha256_hash TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS detection_status TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS detection_result TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS scanner_type TEXT DEFAULT 'Static Triage Scanner';
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS scan_notes TEXT;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS tested_at TIMESTAMPTZ;
ALTER TABLE public.malware_tests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on malware_tests(id) if not present
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.malware_tests'::regclass AND contype = 'p'
    ) THEN
        SELECT data_type INTO v_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'malware_tests' AND column_name = 'id';

        IF v_id_type = 'uuid' THEN
            UPDATE public.malware_tests SET id = gen_random_uuid() WHERE id IS NULL;
        END IF;
        ALTER TABLE public.malware_tests ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.malware_tests ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on legacy and triage columns so inserts without them succeed
DO $$
DECLARE
    col_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'malware_tests' AND column_name = 'file_hash' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.malware_tests ALTER COLUMN file_hash DROP NOT NULL;
    END IF;

    FOR col_name IN VALUES 
        ('tested_at'), ('detection_result'), ('severity'),
        ('sha256_hash'), ('detection_status'), ('risk_level'), ('scanner_type'), 
        ('file_name'), ('file_size')
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'malware_tests' AND column_name = col_name AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE public.malware_tests ALTER COLUMN %I DROP NOT NULL', col_name);
            RAISE NOTICE 'Dropped NOT NULL constraint on public.malware_tests.%', col_name;
        END IF;
    END LOOP;
END $$;

-- Drop legacy unique constraints on file_hash or sha256_hash to allow repeated triage scans of samples
DO $$
DECLARE
    con RECORD;
BEGIN
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.malware_tests'::regclass
          AND c.contype = 'u'
          AND a.attname IN ('file_hash', 'sha256_hash')
    LOOP
        EXECUTE format('ALTER TABLE public.malware_tests DROP CONSTRAINT %I', con.conname);
        RAISE NOTICE 'Dropped unique constraint % on public.malware_tests to allow repeated sample scans', con.conname;
    END LOOP;
END $$;

-- Backfill legacy records bidirectionally WITHOUT inventing fake hashes or placeholder scan results
DO $$
BEGIN
    -- Synchronize existing real hash values between legacy and modern columns
    UPDATE public.malware_tests SET sha256_hash = file_hash WHERE sha256_hash IS NULL AND file_hash IS NOT NULL;
    UPDATE public.malware_tests SET file_hash = sha256_hash WHERE file_hash IS NULL AND sha256_hash IS NOT NULL;

    -- Synchronize timestamps between legacy and modern columns
    UPDATE public.malware_tests SET created_at = tested_at WHERE created_at IS NULL AND tested_at IS NOT NULL;
    UPDATE public.malware_tests SET tested_at = created_at WHERE tested_at IS NULL AND created_at IS NOT NULL;

    -- Synchronize detection status/result only when an actual result was recorded
    UPDATE public.malware_tests SET detection_status = detection_result WHERE detection_status IS NULL AND detection_result IS NOT NULL;
    UPDATE public.malware_tests SET detection_result = detection_status WHERE detection_result IS NULL AND detection_status IS NOT NULL;

    -- Synchronize risk level/severity only when an actual classification was recorded
    UPDATE public.malware_tests SET risk_level = severity WHERE risk_level IS NULL AND severity IS NOT NULL;
    UPDATE public.malware_tests SET severity = risk_level WHERE severity IS NULL AND risk_level IS NOT NULL;

    -- Safe non-intrusive metadata defaults for existing rows (DO NOT invent fake hashes or fake scan outcomes)
    UPDATE public.malware_tests SET file_name = 'unknown_sample' WHERE file_name IS NULL;
    UPDATE public.malware_tests SET file_size = 0 WHERE file_size IS NULL;
    UPDATE public.malware_tests SET scanner_type = 'Static Triage Scanner' WHERE scanner_type IS NULL;
    UPDATE public.malware_tests SET created_at = timezone('utc'::text, now()) WHERE created_at IS NULL;
END $$;

-- Trigger: Ensure two-way synchronization between legacy malware columns and modern columns
CREATE OR REPLACE FUNCTION public.sync_malware_test_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sha256_hash IS NULL AND NEW.file_hash IS NOT NULL THEN
        NEW.sha256_hash := NEW.file_hash;
    ELSIF NEW.file_hash IS NULL AND NEW.sha256_hash IS NOT NULL THEN
        NEW.file_hash := NEW.sha256_hash;
    END IF;

    IF NEW.created_at IS NULL AND NEW.tested_at IS NOT NULL THEN
        NEW.created_at := NEW.tested_at;
    ELSIF NEW.tested_at IS NULL AND NEW.created_at IS NOT NULL THEN
        NEW.tested_at := NEW.created_at;
    END IF;

    IF NEW.detection_status IS NULL AND NEW.detection_result IS NOT NULL THEN
        NEW.detection_status := NEW.detection_result;
    ELSIF NEW.detection_result IS NULL AND NEW.detection_status IS NOT NULL THEN
        NEW.detection_result := NEW.detection_status;
    END IF;

    IF NEW.risk_level IS NULL AND NEW.severity IS NOT NULL THEN
        NEW.risk_level := NEW.severity;
    ELSIF NEW.severity IS NULL AND NEW.risk_level IS NOT NULL THEN
        NEW.severity := NEW.risk_level;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_malware_test_columns ON public.malware_tests;
CREATE TRIGGER trg_sync_malware_test_columns
BEFORE INSERT OR UPDATE ON public.malware_tests
FOR EACH ROW EXECUTE FUNCTION public.sync_malware_test_columns();


-- ------------------------------------------------------------------------------
-- 4. RECONCILE REPORTS TABLE
-- ------------------------------------------------------------------------------

-- Ensure all expected columns exist
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS incident_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_title TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Medium';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS analysis_result TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS response_notes TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_content TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS generated_by TEXT DEFAULT 'SecOps Analyst';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on reports(id) if not present
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.reports'::regclass AND contype = 'p'
    ) THEN
        SELECT data_type INTO v_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'id';

        IF v_id_type = 'uuid' THEN
            UPDATE public.reports SET id = gen_random_uuid() WHERE id IS NULL;
        END IF;
        ALTER TABLE public.reports ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.reports ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on legacy and modern report columns so inserts of either format succeed
DO $$
DECLARE
    col_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'report_id' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.reports ALTER COLUMN report_id DROP NOT NULL;
    END IF;

    FOR col_name IN VALUES 
        ('report_content'), ('incident_id'), ('report_title'), 
        ('analysis_result'), ('response_notes')
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = col_name AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE public.reports ALTER COLUMN %I DROP NOT NULL', col_name);
            RAISE NOTICE 'Dropped NOT NULL constraint on public.reports.%', col_name;
        END IF;
    END LOOP;
END $$;

-- Backfill legacy records: Preserve original report_id separately; do NOT copy report_id into incident_id unless verified
DO $$
BEGIN
    -- 1. Ensure every report has its own unique report identifier (preserves original report_id if present)
    UPDATE public.reports 
    SET report_id = 'REP-' || substr(replace(id::text, '-', ''), 1, 8) 
    WHERE report_id IS NULL;

    -- 2. ONLY copy report_id into incident_id IF the relationship is verified against an existing incident
    UPDATE public.reports r
    SET incident_id = r.report_id
    WHERE r.incident_id IS NULL
      AND r.report_id IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM public.incidents i
          WHERE i.incident_id = r.report_id OR i.id::text = r.report_id
      );

    -- 3. Synchronize report analysis content between legacy text and modern structured field
    UPDATE public.reports SET analysis_result = report_content WHERE analysis_result IS NULL AND report_content IS NOT NULL;
    UPDATE public.reports SET report_content = analysis_result WHERE report_content IS NULL AND analysis_result IS NOT NULL;

    -- 4. Fill defaults for display fields on existing records
    UPDATE public.reports 
    SET report_title = CASE 
        WHEN incident_id IS NOT NULL THEN 'Report for ' || incident_id 
        ELSE 'Incident Analysis Report' 
    END 
    WHERE report_title IS NULL;

    UPDATE public.reports SET risk_score = 0 WHERE risk_score IS NULL;
    UPDATE public.reports SET severity = 'Medium' WHERE severity IS NULL;
    UPDATE public.reports SET analysis_result = 'Automated triage completed.' WHERE analysis_result IS NULL;
    UPDATE public.reports SET response_notes = 'No remediation notes recorded.' WHERE response_notes IS NULL;
    UPDATE public.reports SET generated_by = 'SecOps Analyst' WHERE generated_by IS NULL;
    UPDATE public.reports SET created_at = timezone('utc'::text, now()) WHERE created_at IS NULL;
END $$;

-- Trigger: Ensure synchronization between legacy report columns and modern columns WITHOUT conflating report_id and incident_id
CREATE OR REPLACE FUNCTION public.sync_report_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure each report has its own report_id distinct from incident_id
    IF NEW.report_id IS NULL THEN
        NEW.report_id := 'REP-' || substr(replace(coalesce(NEW.id::text, md5(random()::text || clock_timestamp()::text)), '-', ''), 1, 8);
    END IF;

    -- Synchronize analysis content
    IF NEW.analysis_result IS NULL AND NEW.report_content IS NOT NULL THEN
        NEW.analysis_result := NEW.report_content;
    ELSIF NEW.report_content IS NULL AND NEW.analysis_result IS NOT NULL THEN
        NEW.report_content := NEW.analysis_result;
    END IF;

    -- Provide title fallback if absent
    IF NEW.report_title IS NULL THEN
        NEW.report_title := CASE 
            WHEN NEW.incident_id IS NOT NULL THEN 'Report for ' || NEW.incident_id 
            ELSE 'Incident Report (' || NEW.report_id || ')' 
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_report_columns ON public.reports;
CREATE TRIGGER trg_sync_report_columns
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.sync_report_columns();


-- ------------------------------------------------------------------------------
-- 5. RECONCILE RESPONSE_RULES, THREATS, YARA_RULES
-- ------------------------------------------------------------------------------

-- 5A. response_rules
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS rule_id TEXT;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS condition_query TEXT;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Medium';
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.response_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on response_rules(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.response_rules'::regclass AND contype = 'p'
    ) THEN
        UPDATE public.response_rules SET id = gen_random_uuid() WHERE id IS NULL;
        ALTER TABLE public.response_rules ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.response_rules ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on legacy and modern response_rules columns
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOR col_name IN VALUES ('condition_query'), ('action_taken'), ('status'), ('condition'), ('severity')
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'response_rules' AND column_name = col_name AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE public.response_rules ALTER COLUMN %I DROP NOT NULL', col_name);
            RAISE NOTICE 'Dropped NOT NULL constraint on public.response_rules.%', col_name;
        END IF;
    END LOOP;
END $$;

-- Backfill response_rules bidirectionally
DO $$
BEGIN
    UPDATE public.response_rules SET condition = condition_query WHERE condition IS NULL AND condition_query IS NOT NULL;
    UPDATE public.response_rules SET condition_query = condition WHERE condition_query IS NULL AND condition_query IS NOT NULL;
    UPDATE public.response_rules SET is_active = (status = 'Active') WHERE is_active IS NULL AND status IS NOT NULL;
    UPDATE public.response_rules SET status = CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END WHERE status IS NULL AND is_active IS NOT NULL;
    UPDATE public.response_rules SET rule_id = 'RULE-' || substr(replace(id::text, '-', ''), 1, 8) WHERE rule_id IS NULL;
END $$;

-- Trigger: Synchronize response_rules condition <-> condition_query
CREATE OR REPLACE FUNCTION public.sync_response_rule_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.condition IS NULL AND NEW.condition_query IS NOT NULL THEN
        NEW.condition := NEW.condition_query;
    ELSIF NEW.condition_query IS NULL AND NEW.condition IS NOT NULL THEN
        NEW.condition_query := NEW.condition;
    END IF;

    IF NEW.is_active IS NULL AND NEW.status IS NOT NULL THEN
        NEW.is_active := (NEW.status = 'Active');
    ELSIF NEW.status IS NULL AND NEW.is_active IS NOT NULL THEN
        NEW.status := CASE WHEN NEW.is_active THEN 'Active' ELSE 'Inactive' END;
    END IF;

    IF NEW.rule_id IS NULL THEN
        NEW.rule_id := 'RULE-' || substr(replace(coalesce(NEW.id::text, md5(random()::text || clock_timestamp()::text)), '-', ''), 1, 8);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_response_rule_columns ON public.response_rules;
CREATE TRIGGER trg_sync_response_rule_columns
BEFORE INSERT OR UPDATE ON public.response_rules
FOR EACH ROW EXECUTE FUNCTION public.sync_response_rule_columns();


-- 5B. threats
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS threat_name TEXT;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS threat_type TEXT;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'Medium';
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'External Feed';
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS ioc_indicators TEXT;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.threats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on threats(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.threats'::regclass AND contype = 'p'
    ) THEN
        UPDATE public.threats SET id = gen_random_uuid() WHERE id IS NULL;
        ALTER TABLE public.threats ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.threats ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on legacy threats columns
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOR col_name IN VALUES ('severity'), ('ioc_indicators'), ('description')
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'threats' AND column_name = col_name AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE public.threats ALTER COLUMN %I DROP NOT NULL', col_name);
            RAISE NOTICE 'Dropped NOT NULL constraint on public.threats.%', col_name;
        END IF;
    END LOOP;
END $$;

-- Backfill threats bidirectionally
DO $$
BEGIN
    UPDATE public.threats SET risk_level = severity WHERE risk_level IS NULL AND severity IS NOT NULL;
    UPDATE public.threats SET severity = risk_level WHERE severity IS NULL AND risk_level IS NOT NULL;
END $$;

-- Trigger: Synchronize threats risk_level <-> severity
CREATE OR REPLACE FUNCTION public.sync_threat_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.risk_level IS NULL AND NEW.severity IS NOT NULL THEN
        NEW.risk_level := NEW.severity;
    ELSIF NEW.severity IS NULL AND NEW.risk_level IS NOT NULL THEN
        NEW.severity := NEW.risk_level;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_threat_columns ON public.threats;
CREATE TRIGGER trg_sync_threat_columns
BEFORE INSERT OR UPDATE ON public.threats
FOR EACH ROW EXECUTE FUNCTION public.sync_threat_columns();


-- 5C. yara_rules
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS rule_id TEXT;
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Medium';
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS rule_content TEXT;
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.yara_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on yara_rules(id)
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.yara_rules'::regclass AND contype = 'p'
    ) THEN
        SELECT data_type INTO v_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'yara_rules' AND column_name = 'id';

        IF v_id_type = 'uuid' THEN
            UPDATE public.yara_rules SET id = gen_random_uuid() WHERE id IS NULL;
        END IF;
        ALTER TABLE public.yara_rules ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.yara_rules ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Drop NOT NULL on yara_rules description
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'yara_rules' AND column_name = 'description' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.yara_rules ALTER COLUMN description DROP NOT NULL;
    END IF;
END $$;

-- Backfill missing rule_id
DO $$
BEGIN
    UPDATE public.yara_rules 
    SET rule_id = 'YARA-' || substr(replace(id::text, '-', ''), 1, 8) 
    WHERE rule_id IS NULL;
END $$;

-- Trigger: Synchronize yara_rules rule_id
CREATE OR REPLACE FUNCTION public.sync_yara_rule_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rule_id IS NULL THEN
        NEW.rule_id := 'YARA-' || substr(replace(coalesce(NEW.id::text, md5(random()::text || clock_timestamp()::text)), '-', ''), 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_yara_rule_columns ON public.yara_rules;
CREATE TRIGGER trg_sync_yara_rule_columns
BEFORE INSERT OR UPDATE ON public.yara_rules
FOR EACH ROW EXECUTE FUNCTION public.sync_yara_rule_columns();


-- ------------------------------------------------------------------------------
-- 6. RECONCILE TEAM_MEMBERS ROSTER (SAFE HANDLING OF MISSING EMAILS)
-- ------------------------------------------------------------------------------

-- Ensure team_members table columns exist
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'SecOps Analyst';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Defensive Primary Key on team_members(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.team_members'::regclass AND contype = 'p'
    ) THEN
        UPDATE public.team_members SET id = gen_random_uuid() WHERE id IS NULL;
        ALTER TABLE public.team_members ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.team_members ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Safe handling of existing team_members rows with missing emails:
-- Zero records deleted. No silent account assignments. No admin privileges granted.
DO $$
DECLARE
    v_unassigned_count INTEGER := 0;
BEGIN
    -- 1. If user_id is already associated with an auth.users record, retrieve that user's email
    UPDATE public.team_members tm
    SET email = lower(trim(au.email))
    FROM auth.users au
    WHERE tm.user_id = au.id
      AND (tm.email IS NULL OR trim(tm.email) = '')
      AND au.email IS NOT NULL
      AND trim(au.email) <> '';

    -- 2. If email is already present but user_id is NULL, link to confirmed auth account without changing role
    UPDATE public.team_members tm
    SET user_id = au.id
    FROM auth.users au
    WHERE tm.user_id IS NULL
      AND tm.email IS NOT NULL
      AND trim(tm.email) <> ''
      AND lower(trim(tm.email)) = lower(trim(au.email))
      AND au.confirmed_at IS NOT NULL;

    -- 3. For any remaining rows where email is STILL missing (unidentifiable legacy records):
    -- PRESERVE THE ROW (do not delete).
    -- Deactivate it so it cannot be used to authenticate or bypass authorization.
    -- Do NOT elevate role (preserve role, or default to 'SecOps Analyst' if null).
    -- Assign a non-login placeholder email under RFC 2606 .invalid to satisfy NOT NULL & UNIQUE index.
    SELECT count(*) INTO v_unassigned_count
    FROM public.team_members
    WHERE email IS NULL OR trim(email) = '';

    IF v_unassigned_count > 0 THEN
        UPDATE public.team_members
        SET is_active = false,
            email = 'unassigned-' || id::text || '@disabled.invalid',
            role = CASE WHEN role IS NULL OR trim(role) = '' THEN 'SecOps Analyst' ELSE role END
        WHERE email IS NULL OR trim(email) = '';

        RAISE NOTICE 'Preserved % unassigned team_members record(s) with missing email by marking them inactive.', v_unassigned_count;
    END IF;

    -- 4. Check for case-insensitive duplicate emails among valid records
    IF EXISTS (
        SELECT lower(trim(email))
        FROM public.team_members
        WHERE email NOT LIKE '%@disabled.invalid'
        GROUP BY lower(trim(email))
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Case-insensitive duplicate emails detected in public.team_members. Resolve duplicates before applying migration.';
    END IF;
END $$;

-- Set NOT NULL on email now that all rows have valid/safe email addresses
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'email' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.team_members ALTER COLUMN email SET NOT NULL;
    END IF;
END $$;

-- Case-insensitive Unique Index on team_members(lower(email))
DO $$
BEGIN
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

-- Defensive Foreign Key on team_members(user_id) referencing auth.users(id)
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
        ALTER TABLE public.team_members
        ADD CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 7. RE-ENABLE ROW LEVEL SECURITY (RLS) ON ALL SEVEN TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malware_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yara_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 8. SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_authorized_team_member()
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
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.is_authorized_team_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_team_member() TO authenticated;

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
-- 9. EXPLICIT TABLE PRIVILEGES (DEFENSE-IN-DEPTH)
-- ------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.incidents FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.malware_tests FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.yara_rules FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.reports FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.threats FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.response_rules FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.team_members FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.malware_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yara_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.threats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.response_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_members TO authenticated;


-- ------------------------------------------------------------------------------
-- 10. DROP ALL ANONYMOUS/PERMISSIVE POLICIES
-- ------------------------------------------------------------------------------

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
-- 11. RECREATE STRICT TEAM-ONLY POLICIES FOR ALL SEVEN TABLES
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

-- Team Members Roster
DROP POLICY IF EXISTS "Allow anon all on team_members" ON public.team_members;
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


-- ------------------------------------------------------------------------------
-- 12. LOCKOUT PREVENTION & ROSTER STATUS DIAGNOSTIC
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_admin_count INTEGER := 0;
    v_member_count INTEGER := 0;
    v_incident_count INTEGER := 0;
    v_malware_count INTEGER := 0;
    v_yara_count INTEGER := 0;
    v_report_count INTEGER := 0;
    v_threat_count INTEGER := 0;
    v_rule_count INTEGER := 0;
BEGIN
    SELECT count(*) INTO v_member_count FROM public.team_members WHERE is_active = true;
    SELECT count(*) INTO v_admin_count FROM public.team_members 
    WHERE is_active = true AND lower(role) IN ('admin', 'secops admin', 'incident lead responder', 'lead');

    SELECT count(*) INTO v_incident_count FROM public.incidents;
    SELECT count(*) INTO v_malware_count FROM public.malware_tests;
    SELECT count(*) INTO v_yara_count FROM public.yara_rules;
    SELECT count(*) INTO v_report_count FROM public.reports;
    SELECT count(*) INTO v_threat_count FROM public.threats;
    SELECT count(*) INTO v_rule_count FROM public.response_rules;

    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'Migration 03 Complete: IRM Schema Reconciled Successfully.';
    RAISE NOTICE 'Active Team Members: % | Active Administrators: %', v_member_count, v_admin_count;
    RAISE NOTICE 'Preserved Records: Incidents: % | Malware Tests: % | YARA Rules: % | Reports: % | Threats: % | Response Rules: %',
        v_incident_count, v_malware_count, v_yara_count, v_report_count, v_threat_count, v_rule_count;

    IF v_admin_count = 0 THEN
        RAISE NOTICE '--------------------------------------------------------------';
        RAISE NOTICE 'IMPORTANT LOCKOUT WARNING:';
        RAISE NOTICE 'No active administrator is currently present in public.team_members.';
        RAISE NOTICE 'To ensure you can log into the application, provision your admin account:';
        RAISE NOTICE 'Run:';
        RAISE NOTICE '  INSERT INTO public.team_members (user_id, email, role, is_active)';
        RAISE NOTICE '  SELECT id, email, ''admin'', true FROM auth.users WHERE lower(email) = lower(''your-email@example.com'')';
        RAISE NOTICE '  ON CONFLICT ((lower(email))) DO UPDATE SET user_id = EXCLUDED.user_id, role = ''admin'', is_active = true;';
        RAISE NOTICE '--------------------------------------------------------------';
    ELSE
        RAISE NOTICE 'Active administrator is verified. Existing login sessions will remain valid.';
    END IF;
    RAISE NOTICE '==============================================================';
END $$;
