# Incident Response Module (IRM) — Complete Setup, Database & Security Guide

A Next.js (App Router, React 19, TypeScript, Tailwind CSS) Security Operations and Incident Response application based on the **AU → IRM → GU** three-tier pipeline architecture.

---

## 🏛 Architecture Pipeline

- **Arithmetic Unit (AU)**: Calculates objective numerical risk scores using probability theory:
  $$\text{Risk Score} = \text{Likelihood} \times \text{Impact}$$
  - **Likelihood**: Probability of threat occurrence ($0.00 \le L \le 1.00$).
  - **Impact**: Severity of asset consequence ($0 \le I \le 100$).
  - **Risk Score**: Normalized integer value ($0 \le R \le 100$).
- **Incident Response Module (IRM)**: Core business and security domain logic. Evaluates risk scores against configurable response rules, classifies incidents into operational severities (`Low`, `Medium`, `High`, `Critical`), applies mitigation policies, and synchronizes state with the database.
- **Graphical Unit (GU)**: Security Operations Center (SOC) presentation layer providing live posture gauges, pie/bar telemetry charts, interactive YARA testing, non-executing malware triage, and standalone HTML incident report generation.

---

## 🚀 Quick Start (Local Prototype Mode)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run Security Test Suite:**
   ```bash
   npm test
   ```

3. **Verify Type-Checking & Production Build:**
   ```bash
   npm run typecheck
   npm run build
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   > *Note for Windows users*: If Turbopack native bindings fail or report lockfile path warnings on Windows, run with webpack:
   > ```bash
   > npm run dev:webpack
   > ```

5. **Open in Browser:**
   Visit [http://localhost:3000](http://localhost:3000). Evaluators can log in using `team@secops.local` / `SecOps2026!` or click "Fill Demo Credentials".

---

## 📦 Completed Modules Overview

### 1. Dashboard (`/`)
- **Key Metrics**: 5 dedicated counts: Total Incidents, Open/Active, High-Risk ($\ge 50$), Critical ($\ge 80$), and Resolved.
- **AU Mean Risk Gauge**: Real-time mean score calculation with dynamic severity ring meter.
- **AU → IRM → GU Pipeline Visualization**: Architecture telemetry banner showing the status of each pipeline stage.
- **Visualizations**: Severity distribution donut chart and 7-day response timeline bar chart.
- **Recent Incidents**: Quick overview of recent cases with direct links to full management.

### 2. Incident Management (`/incidents`)
- **Full Lifecycle**: List, filter by status (`Open`, `Investigating`, `Resolved`), filter by severity, and instant keyword search.
- **Automated Incident File Import (CSV & JSON)**:
  - **Upload & Parse**: Ingest bulk incidents via CSV (RFC 4180 compliant) or JSON files (max 5 MB, up to 500 records).
  - **Downloadable Sample CSV Template**: One-click download of `irm_incidents_template.csv` showing exact columns (`incident_id`, `incident_name`, `description`, `likelihood`, `impact`, `status`, `source`).
  - **Row-Level Pre-Validation**: Inspects missing required fields, numeric range constraints (Likelihood: $0.00-1.00$, Impact: $0-100$), and malformed records before saving.
  - **Duplicate Detection & Auto-ID**: Detects existing and intra-file duplicate IDs (skipped automatically) and generates unique IDs (`INC-AUTO-XXX`) when omitted.
  - **Live AU Preview & Confirm**: Shows pre-computed AU Risk scores ($\text{round}(L \times I)$) and IRM severity badges for valid rows.
  - **Synchronized Refresh**: Immediately updates the Incident Table, Dashboard counters, risk meters, and feeds upon import.
- **Create Incident Modal**: Dual range sliders and numeric input fields for Likelihood ($0-1$) and Impact ($0-100$) with live AU risk computation preview.
- **View Details Modal**: Displays complete incident telemetry, exact AU calculation breakdown, status badges, timestamps, and full description.
- **Status & Deletion**: In-table status transition dropdown and record deletion with confirmation.

### 3. Malware Analysis & Triage (`/malware`)
- **Safe Static Triage**: Non-executing analysis pipeline. Computes genuine cryptographic SHA-256 hashes client-side in browser memory using the native Web Crypto API (`crypto.subtle.digest`).
- **Harmless Test Vectors**: One-click preload for standard test samples (EICAR Standard, benign PowerShell script, simulated ransomware note, diagnostic log).
- **Transparent Classification**: Detections are prominently badged as `[SIMULATED ENGINES]`.
- **Database Integration**: Record scan results with hashes, status, and notes to the database.

### 4. YARA & Response Rules (`/rules`)
- **YARA Rules Catalog**: Metadata viewer with rule ID, name, description, severity, syntax code, and active toggle.
- **Preloaded Sample Rules**: Tagged as `[DEMO SAMPLE]`: `YARA-001` through `YARA-004`.
- **Simulated Pattern Matcher**: Safely parses test text against active rules.
- **AU Response Rule Matrix**: View and test the Arithmetic Unit's risk-to-severity classification thresholds.

### 5. Reports & Analytics (`/reports`)
- **Standalone HTML Report Generation**: Generates and downloads a self-contained `.html` forensic report with embedded styles, AU risk breakdown, malware analysis findings, and remediation notes.
- **XSS Sanitization**: All user-supplied text is sanitized with strict HTML entity escaping (`escapeHtml`).
- **Historical Reports**: Catalog of past generated reports stored in Supabase with one-click re-download.

---

## 🗄️ Supabase Cloud Database & Team Security Setup

### Phase 1: Confirm Your Supabase Project

1. Log in to your [Supabase Dashboard](https://app.supabase.com).
2. Select your project and navigate to **Project Settings** $\to$ **General**.
3. Verify your **Project Name**, **Reference ID**, and **API URL** match your expected project (e.g., `https://<your-project-id>.supabase.co`).

---

### Phase 2: Read-Only Pre-Flight Inspection (Run Before Applying Changes)

> [!NOTE]
> These queries are **100% READ-ONLY**. They inspect your current database state without modifying or deleting any data.

Open the **SQL Editor** in your Supabase Dashboard and run these inspection queries:

```sql
-- 1. Check existing tables in public schema:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check existing Row Level Security policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 3. Check existing constraints:
SELECT conname, contype, conrelid::regclass AS table_name 
FROM pg_constraint 
WHERE connamespace = 'public'::regnamespace 
ORDER BY table_name, conname;

-- 4. Check existing Auth accounts (inspect emails and confirmation status):
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- 5. Check team_members roster (if the table already exists):
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
        RAISE NOTICE 'team_members table exists. Review records below:';
    ELSE
        RAISE NOTICE 'team_members table does not exist yet (fresh database).';
    END IF;
END $$;
```

---

### Phase 3: Apply the Database Schema & Security Setup

Choose **Scenario A** or **Scenario B** depending on your inspection results:

#### Scenario A: Fresh Database Installation (Recommended for New Projects)
If your inspection returned zero tables in the `public` schema:

1. In Supabase Dashboard, go to **SQL Editor**.
2. Click **"New query"**.
3. Copy and paste the complete contents of [`supabase/schema.sql`](./supabase/schema.sql).
4. Click **"Run"**.
   > **What this does:**
   > - Creates all 6 application tables (`incidents`, `malware_tests`, `yara_rules`, `reports`, `threats`, `response_rules`).
   > - Creates `public.team_members` with primary key, foreign key (`auth.users(id)` `ON DELETE CASCADE`), and case-insensitive unique index (`team_members_lower_email_idx`).
   > - Defensively enables Row Level Security (RLS) on all 7 tables.
   > - Creates `is_authorized_team_member()` and `is_team_admin()` with `SECURITY DEFINER` and fixed `search_path`.
   > - Creates strict team-only RLS policies for all tables.
   > - **Creates ZERO anonymous access policies** (all unauthenticated access is denied by default).

#### Scenario B: Upgrading an Existing / Older Schema (Preserves All Records)
If your database already has older tables (e.g., `malware_tests` with `tested_at`/`file_hash`, `incidents` with `title`, `reports` with `report_id`/`report_content`, or missing tables):

1. In Supabase Dashboard, go to **SQL Editor**.
2. Click **"New query"**.
3. Copy and paste the complete contents of [`supabase/migrations/03_reconcile_application_schema.sql`](./supabase/migrations/03_reconcile_application_schema.sql).
4. Click **"Run"**.
   > **What this does:**
   > - **Zero Data Loss**: Does NOT drop any tables or delete any records.
   > - **Reconciles `malware_tests`**: Adds `created_at`, `sha256_hash`, `detection_status`, `risk_level`, `scanner_type`, `scan_notes`, and backfills from legacy `tested_at`, `file_hash`, `detection_result`, `severity`.
   > - **Reconciles `incidents`**: Synchronizes `title` and `incident_name`, backfills AU `risk_score`, `likelihood`, `impact`, and adds bidirectional sync triggers.
   > - **Reconciles `reports`**: Adds modern forensic report fields and backfills from legacy `report_id` and `report_content`.
   > - **Creates Missing Tables**: Adds `yara_rules`, `threats`, `response_rules`, and `team_members` if absent.
   > - **Enforces RLS & Privileges**: Enables RLS on all 7 tables, drops all legacy anonymous policies, and grants team-only access.

#### Optional: Populate Baseline Demo Records
If you wish to populate baseline sample incidents, YARA rules, and threat feeds for evaluation:
1. Open **SQL Editor**.
2. Run [`supabase/seed.sql`](./supabase/seed.sql). (Safe to re-run: uses `ON CONFLICT DO NOTHING`).

---

### Phase 4: Configure Supabase Auth & Disable Public Registration

1. In Supabase Dashboard, go to **Authentication** $\to$ **Configuration** $\to$ **Sign In / Up** (or **Email** provider).
2. **Turn OFF** "Enable email signup" / "Allow new users to sign up".
   > This enforces team-only access by preventing arbitrary public registration.
3. Keep **"Enable Email provider"** turned ON.

---

### Phase 5: Create & Provision the Initial Administrator (Fail-Closed)

Because fail-closed security denies access to everyone when `team_members` is empty, an administrator must be provisioned via the Supabase Dashboard:

#### Step 1: Create the User in Supabase Auth
1. Go to **Authentication** $\to$ **Users** in your Supabase Dashboard.
2. Click **"Add user"** $\to$ **"Create user"**.
3. Enter your administrator email (e.g., `admin@yourcompany.com`) and password.
4. Check **"Auto Confirm User?"** so the email is immediately verified without waiting for an email link.
5. Click **"Create user"**.

#### Step 2: Provision Administrator Roster Record in SQL Editor
Open **SQL Editor** and run the fail-safe provisioning script (replace `admin@yourcompany.com` with your administrator's email):

```sql
DO $$
DECLARE
    v_admin_email CONSTANT TEXT := lower('admin@yourcompany.com');
    v_user_count INTEGER;
    v_auth_id UUID;
    v_is_confirmed BOOLEAN;
    v_existing_id UUID;
    v_existing_user_id UUID;
    v_existing_role TEXT;
    v_existing_is_active BOOLEAN;
BEGIN
    -- 1. Check matching accounts in auth.users
    SELECT count(*)
    INTO v_user_count
    FROM auth.users
    WHERE lower(email) = v_admin_email;

    IF v_user_count = 0 THEN
        RAISE EXCEPTION 'Provisioning halted: No account found in auth.users for email "%". Create user in Supabase Dashboard -> Authentication -> Users first.', v_admin_email;
    ELSIF v_user_count > 1 THEN
        RAISE EXCEPTION 'Provisioning halted: Multiple accounts found in auth.users for email "%" (case-insensitive collision). Resolve duplicate auth accounts before proceeding.', v_admin_email;
    END IF;

    -- 2. Verify confirmed email and retrieve Auth UUID via separate query (avoiding aggregates on uuid)
    SELECT id, (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
    INTO v_auth_id, v_is_confirmed
    FROM auth.users
    WHERE lower(email) = v_admin_email;

    IF NOT coalesce(v_is_confirmed, false) THEN
        RAISE EXCEPTION 'Provisioning halted: Account "%" has not confirmed their email (email_confirmed_at is NULL). In Dashboard -> Authentication -> Users, check "Auto Confirm User".', v_admin_email;
    END IF;

    -- 3. Check existing membership in public.team_members
    SELECT id, user_id, role, is_active
    INTO v_existing_id, v_existing_user_id, v_existing_role, v_existing_is_active
    FROM public.team_members
    WHERE lower(email) = v_admin_email;

    IF v_existing_id IS NOT NULL THEN
        -- Guard 3a: Refuse silent reactivation of inactive memberships
        IF v_existing_is_active = false THEN
            RAISE EXCEPTION 'Provisioning halted: Team member "%" (ID: %) exists but is currently deactivated (is_active = false). The provisioning script will not silently reactivate an inactive account. Perform an intentional reactivation if intended: UPDATE public.team_members SET is_active = true WHERE id = ''%'';', v_admin_email, v_existing_id, v_existing_id;
        END IF;

        -- Guard 3b: Refuse implicit role elevation of ordinary analysts
        IF lower(v_existing_role) NOT IN ('admin', 'secops admin', 'incident lead responder', 'lead') THEN
            RAISE EXCEPTION 'Provisioning halted: "%" already exists as an ordinary member with role "%". Implicit elevation to administrator is forbidden. To intentionally promote this member, run explicit promotion: UPDATE public.team_members SET role = ''Incident Lead Responder'', user_id = ''%'' WHERE id = ''%'';', v_admin_email, v_existing_role, v_auth_id, v_existing_id;
        END IF;

        -- Guard 3c: Refuse silent account reassignment if already linked to a different Auth ID
        IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> v_auth_id THEN
            RAISE EXCEPTION 'Provisioning halted: Administrator "%" (ID: %) is already bound to Auth user ID % (different from incoming Auth ID %). Silently reassigning an existing administrator account association is forbidden. Resolve account association manually.', v_admin_email, v_existing_id, v_existing_user_id, v_auth_id;
        END IF;

        -- Guard 3d: Already properly configured and linked
        IF v_existing_user_id = v_auth_id THEN
            RAISE NOTICE 'Administrator membership already exists for "%" and is actively linked to Auth UUID %. No changes made.', v_admin_email, v_auth_id;
        -- Guard 3e: Pre-existing admin with NULL user_id: safe initial association
        ELSIF v_existing_user_id IS NULL THEN
            UPDATE public.team_members
            SET user_id = v_auth_id
            WHERE id = v_existing_id;
            RAISE NOTICE 'Successfully linked Auth UUID % to existing unlinked administrator "%" (role: "%").', v_auth_id, v_admin_email, v_existing_role;
        END IF;
    ELSE
        -- 4. Insert new administrator record
        INSERT INTO public.team_members (user_id, email, role, is_active)
        VALUES (v_auth_id, v_admin_email, 'Incident Lead Responder', true);
        RAISE NOTICE 'Successfully provisioned administrator for "%" with Auth UUID %.', v_admin_email, v_auth_id;
    END IF;
END $$;
```

#### Step 3: Verify Administrator Provisioning
Run this verification query in the SQL Editor:
```sql
SELECT tm.id, tm.user_id, tm.email, tm.role, tm.is_active, 
       u.email AS auth_email, u.email_confirmed_at
FROM public.team_members tm
LEFT JOIN auth.users u ON u.id = tm.user_id
WHERE lower(tm.email) = lower('admin@yourcompany.com');
```

---

### Phase 6: Adding Authorized Team Members

When adding additional security analysts:

1. In Supabase Dashboard, go to **Authentication** $\to$ **Users** $\to$ **"Add user"** $\to$ **"Create user"**.
2. Enter the analyst's email (e.g., `analyst@yourcompany.com`) and password. Check **"Auto Confirm User"**.
3. In **SQL Editor**, insert their authorization record:
   ```sql
   INSERT INTO public.team_members (user_id, email, role, is_active)
   SELECT id, email, 'SecOps Analyst', true
   FROM auth.users
   WHERE lower(email) = lower('analyst@yourcompany.com')
     AND email_confirmed_at IS NOT NULL;
   ```

#### Separate Administrative Action: Explicit Promotion of an Existing Team Member
If an existing analyst is promoted to an administrator, run this explicit update:
```sql
UPDATE public.team_members
SET role = 'Incident Lead Responder',
    user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('analyst@yourcompany.com')),
    is_active = true
WHERE lower(email) = lower('analyst@yourcompany.com');
```

---

### Phase 7: Environment Variables Setup (Local & Vercel)

#### Local Development (`.env.local`)
Create `.env.local` in your project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

> [!WARNING]
> - Use only your public **Anon Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
> - **NEVER** expose your `service_role` key or database password in `.env.local`, client code, or repository commits.

#### Vercel Deployment Configuration
In your Vercel Project Dashboard:
1. Go to **Settings** $\to$ **Environment Variables**.
2. Add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-anon-public-key>`
3. Set environment to **Production**, **Preview**, and **Development**.
4. Redeploy your project.

---

### Phase 8: Testing Login, Page Protection & Team Permissions

Follow this checklist to verify your deployment:

1. **Test Unauthenticated Protection**:
   - Open an incognito browser window.
   - Navigate to `http://localhost:3000/` or `https://your-vercel-domain.com/incidents`.
   - **Expected Result**: Immediately redirected to `/login`.
2. **Test Non-Team Account Rejection (Fail-Closed)**:
   - Create a test account in Supabase Auth that is NOT added to `team_members`.
   - Attempt to log in with that test account.
   - **Expected Result**: Access is denied; redirected to `/login?error=unauthorized`.
3. **Test Authorized Team Member Login**:
   - Log in with your provisioned administrator credentials.
   - **Expected Result**: Successfully redirected to the Dashboard (`/`).
4. **Test Application Data Operations**:
   - Navigate to `/incidents`, click "Report New Incident", and submit a test incident.
   - Click "Import Incidents" and import a sample CSV file.
   - **Expected Result**: Incidents are saved to Supabase and visible on the Dashboard.
5. **Test Logout**:
   - Click "Sign Out".
   - **Expected Result**: Session cookie cleared and redirected back to `/login`.

---

### Phase 9: Safe Troubleshooting & Migration Retries

If an error occurs during migration:

1. **Error: `relation "public.incidents" does not exist`**:
   - **Cause**: Migration 02 was run on an empty database.
   - **Fix**: Run `supabase/schema.sql` first.
2. **Error: `duplicate email record(s)`**:
   - **Cause**: Existing `team_members` table has duplicate emails with different cases.
   - **Diagnostic Query**:
     ```sql
     SELECT lower(email), count(*) FROM public.team_members GROUP BY lower(email) HAVING count(*) > 1;
     ```
   - **Fix**: Resolve duplicate emails before re-running migration 02.
3. **Error: `orphaned user_id values`**:
   - **Cause**: Existing `team_members` records reference deleted Auth user IDs.
   - **Diagnostic Query**:
     ```sql
     SELECT tm.id, tm.user_id, tm.email FROM public.team_members tm WHERE tm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tm.user_id);
     ```
   - **Fix**: Set orphaned `user_id` values to `NULL` or link them to active Auth users before re-running.
