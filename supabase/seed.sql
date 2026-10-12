-- ==============================================================================
-- Incident Response Module (IRM) — Seed Baseline Data (Optional / Evaluation)
-- Architecture: AU -> IRM -> GU
-- Execution: Run in Supabase SQL Editor if you wish to populate baseline sample
--            records for demonstration or evaluation.
-- Safe to re-run: Uses ON CONFLICT DO NOTHING.
-- ==============================================================================

-- 1. Baseline Incidents
INSERT INTO public.incidents (incident_id, incident_name, severity, likelihood, impact, risk_score, status, description)
VALUES
    ('INC-2026-1041', 'Anomalous PowerShell Execution with Remote Download', 'Critical', 0.90, 92, 83, 'Open', 'EDR alert: PowerShell executed with bypass arguments invoking external staging URL from Workstation WS-04.'),
    ('INC-2026-1039', 'Repeated Brute-Force Attempts on Internal VPN Gateway', 'High', 0.85, 75, 64, 'Investigating', 'Over 450 failed authentication attempts detected from IP 198.51.100.42 within 10 minutes targeting engineering LDAP.'),
    ('INC-2026-1035', 'Unauthorized S3 Bucket Policy Modification', 'High', 0.70, 80, 56, 'Open', 'CloudTrail audit logged an unexpected policy update granting global read access to client telemetry bucket.'),
    ('INC-2026-1028', 'Simulated Phishing Campaign Test Result', 'Medium', 0.50, 50, 25, 'Resolved', 'Scheduled security awareness drill simulated payload delivery to sales department. 3 clicks recorded.'),
    ('INC-2026-1020', 'Suspicious Outbound DNS Tunneling Queries', 'Medium', 0.60, 65, 39, 'Investigating', 'DNS logs show high volume of subdomains queried under unknown dynamic DNS provider indicative of C2 beaconing.'),
    ('INC-2026-1004', 'Expired TLS Certificate on Staging Ingress', 'Low', 0.30, 30, 9, 'Resolved', 'Automated alert for staging environment certificate renewal expiration. Certificate reissued and deployed.')
ON CONFLICT (incident_id) DO NOTHING;

-- 2. Baseline YARA Rules
INSERT INTO public.yara_rules (rule_id, rule_name, description, severity, rule_content, is_active)
VALUES
    ('YARA-001', 'SUSPICIOUS_POWERSHELL_DOWNLOAD', 'Demonstration rule identifying encoded PowerShell web client download executions.', 'High', 'rule Suspicious_PowerShell_Download {
    meta:
        description = "Detects web client download strings in scripts"
        demonstration = "true"
    strings:
        $s1 = "DownloadString" nocase
        $s2 = "Net.WebClient" nocase
        $s3 = "-EncodedCommand" nocase
    condition:
        ($s1 and $s2) or $s3
}', true),
    ('YARA-002', 'EICAR_AV_TEST_STRING', 'Standard anti-virus validation signature string for harmless testing.', 'Critical', 'rule EICAR_Standard_Test_File {
    meta:
        description = "Industry standard anti-virus verification test string"
        reference = "https://www.eicar.org"
        demonstration = "true"
    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}', true),
    ('YARA-003', 'RANSOMWARE_NOTE_INDICATORS', 'Detects common keywords present in extortion and simulated ransom notices.', 'Critical', 'rule Ransomware_Note_Keywords {
    meta:
        description = "Identifies extortion and decryption demand patterns"
        demonstration = "true"
    strings:
        $r1 = "all your files have been encrypted" nocase
        $r2 = "send bitcoin to" nocase
        $r3 = "decrypt your files" nocase
    condition:
        2 of ($r*)
}', true),
    ('YARA-004', 'HIGH_ENTROPY_BASE64_EXEC', 'Heuristic pattern for base64 encoded command arguments in process invocations.', 'Medium', 'rule Suspicious_Base64_Execution {
    meta:
        description = "Base64 execution patterns in CLI tools"
        demonstration = "true"
    strings:
        $b1 = "powershell -e " nocase
        $b2 = "cmd.exe /c echo " nocase
    condition:
        any of them
}', true)
ON CONFLICT (rule_id) DO NOTHING;

-- 3. Baseline Harmless Malware Test Vectors
INSERT INTO public.malware_tests (file_name, file_size, sha256_hash, detection_status, risk_level, scanner_type, scan_notes)
VALUES
    ('eicar_standard_test.com', 68, '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', 'EICAR Standard Test', 'Critical', 'Simulated Signature Engine (EICAR)', 'Matches European Institute for Computer Antivirus Research standard verification signature. Harmless test vector.'),
    ('harmless_recon_script.ps1', 1024, '4a8f117a2b0e68e42718e244b413e110b98a0d0a5e229c9ef6a07cf5814bfb22', 'Suspicious', 'Medium', 'Simulated Heuristic Pattern Engine', 'Simulated pattern match on PowerShell obfuscation flags (e.g., -EncodedCommand, Net.WebClient).'),
    ('system_health_audit.log', 4096, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'Clean', 'Clean', 'Simulated Cryptographic Checksum Engine', 'Cryptographic hash verified against known benign checksum baseline. Zero threats identified.')
ON CONFLICT DO NOTHING;

-- 4. Baseline Incident Reports
INSERT INTO public.reports (incident_id, report_title, risk_score, severity, analysis_result, response_notes, generated_by)
VALUES
    ('INC-2026-1041', 'Forensic Triage: Anomalous PowerShell Remote Download', 83, 'Critical', 'Confirmed unauthorized PowerShell execution attempting payload retrieval from 198.51.100.42. Matched rule YARA-001.', 'Workstation WS-04 isolated from VLAN 12. External staging domain sinkholed at perimeter firewall. Memory dump acquired.', 'SecOps Lead Responder'),
    ('INC-2026-1039', 'Incident Summary: Internal VPN Gateway Brute-Force', 64, 'High', 'Automated brute-force attack originating from external subnet against LDAP accounts. 450 attempts recorded.', 'Origin IP blocked on perimeter gateway rate-limiter. Enforced mandatory MFA re-challenge on 14 affected accounts.', 'Security Operations Center')
ON CONFLICT DO NOTHING;

-- 5. Baseline Threat Intelligence Feeds
INSERT INTO public.threats (threat_name, threat_type, risk_level, source, status)
VALUES
    ('DarkGate Loader Campaign', 'Malware Loader', 'High', 'CISA Advisory AA24-12', 'Active'),
    ('CVE-2024-38063 IPv6 RCE', 'Vulnerability Exploit', 'Critical', 'Microsoft Security Bulletin', 'Mitigated'),
    ('DNS Spoofing on External Resolver', 'Network Tampering', 'Medium', 'BGP Mon / DNS Watchdog', 'Monitoring'),
    ('Credential Stuffing on SSO Portal', 'Identity Attack', 'High', 'Internal SIEM Correlation', 'Active')
ON CONFLICT DO NOTHING;

-- 6. Baseline Response Rules
INSERT INTO public.response_rules (rule_id, rule_name, condition, severity, is_active)
VALUES
    ('RULE-AU-01', 'Critical Risk Automatic Escalation', 'Risk >= 80', 'Critical', true),
    ('RULE-AU-02', 'High Risk SecOps Triage', 'Risk >= 50 AND Risk < 80', 'High', true),
    ('RULE-AU-03', 'Medium Risk Analyst Queue', 'Risk >= 20 AND Risk < 50', 'Medium', true),
    ('RULE-AU-04', 'Low Risk Automated Logging', 'Risk < 20', 'Low', true)
ON CONFLICT (rule_id) DO NOTHING;
