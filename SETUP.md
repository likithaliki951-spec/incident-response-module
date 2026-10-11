# Incident Response Module (IRM) — Complete Setup & Architecture Guide

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

## 🚀 Quick Start (Local Run)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```
   > *Note for Windows users*: If Turbopack native bindings fail or report lockfile path warnings on Windows, run with webpack:
   > ```bash
   > npm run dev:webpack
   > ```

3. **Verify Type-Checking & Production Build:**
   ```bash
   npm run typecheck
   npm run build
   ```

4. **Open in Browser:**
   Visit [http://localhost:3000](http://localhost:3000).

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
- **Harmless Test Vectors**: One-click preload for standard test samples:
  - Official **EICAR Standard Anti-Virus Test File**
  - Benign PowerShell reconnaissance script
  - Simulated ransomware extortion note
  - Clean system diagnostics log
- **Transparent Classification**: Detections are prominently badged as `[SIMULATED ENGINES]`.
- **Database Integration**: Record scan results with hashes, status, and notes to the database.

### 4. YARA & Response Rules (`/rules`)
- **YARA Rules Catalog**: Metadata viewer with rule ID, name, description, severity, syntax code, and active toggle.
- **Preloaded Sample Rules**: Tagged as `[DEMO SAMPLE]`:
  - `YARA-001`: `SUSPICIOUS_POWERSHELL_DOWNLOAD`
  - `YARA-002`: `EICAR_AV_TEST_STRING`
  - `YARA-003`: `RANSOMWARE_NOTE_INDICATORS`
  - `YARA-004`: `HIGH_ENTROPY_BASE64_EXEC`
- **Simulated Pattern Matcher**: Safely parses test text against active rules.
- **SOC Documentation**: Detailed overview of production requirements (native `libyara`, containerized sandboxes, memory quotas, and eBPF kernel hooks).
- **AU Response Rule Matrix**: View and test the Arithmetic Unit's risk-to-severity classification thresholds.

### 5. Reports & Analytics (`/reports`)
- **Standalone HTML Report Generation**: Generates and downloads a self-contained `.html` forensic report with embedded styles, AU risk breakdown, malware analysis findings, and remediation notes.
- **XSS Sanitization**: All user-supplied text is sanitized with strict HTML entity escaping (`escapeHtml`).
- **Historical Reports**: Catalog of past generated reports stored in Supabase with one-click re-download.
- **SOC Analytics**: Incidents by severity breakdown and 7-day average risk trend lines.

---

## 🗄️ Supabase Cloud Database Setup

The application features a **Dual-Mode Data Layer**:
- **Offline / Local Mode**: Operates seamlessly out of the box using structured in-memory seed stores without needing credentials.
- **Cloud Mode**: Connects directly to Supabase via `@supabase/supabase-js` for multi-user cloud persistence.

### To Connect Your Supabase Cloud Database:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) in this repository, copy its content, and run it in the SQL Editor.
   - Creates `incidents`, `malware_tests`, `yara_rules`, `reports`, `threats`, and `response_rules` tables.
   - Enables Row Level Security (RLS) on all tables with sensible public/anon policies.
   - Populates initial realistic seed data safely (`ON CONFLICT DO NOTHING`).
4. Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   ```
5. Fill in your project URL and public Anon Key:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   ```
6. Restart the application server. The database banner will automatically show `Supabase Cloud Database (Live Sync)`.
