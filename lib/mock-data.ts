// Comprehensive seed & fallback data for local prototype mode
import type { Incident, Threat, ResponseRule, MalwareTest, YaraRule, IncidentReport } from "@/lib/irm"

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: "inc-1",
    incident_id: "INC-2026-1041",
    incident_name: "Anomalous PowerShell Execution with Remote Download",
    severity: "Critical",
    likelihood: 0.9,
    impact: 92,
    risk_score: 83,
    status: "Open",
    description: "EDR alert: PowerShell executed with bypass arguments invoking external staging URL from Workstation WS-04.",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "inc-2",
    incident_id: "INC-2026-1039",
    incident_name: "Repeated Brute-Force Attempts on Internal VPN Gateway",
    severity: "High",
    likelihood: 0.85,
    impact: 75,
    risk_score: 64,
    status: "Investigating",
    description: "Over 450 failed authentication attempts detected from IP 198.51.100.42 within 10 minutes targeting engineering LDAP.",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "inc-3",
    incident_id: "INC-2026-1035",
    incident_name: "Unauthorized S3 Bucket Policy Modification",
    severity: "High",
    likelihood: 0.7,
    impact: 80,
    risk_score: 56,
    status: "Open",
    description: "CloudTrail audit logged an unexpected policy update granting global read access to client telemetry bucket.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "inc-4",
    incident_id: "INC-2026-1028",
    incident_name: "Simulated Phishing Campaign Test Result",
    severity: "Medium",
    likelihood: 0.5,
    impact: 50,
    risk_score: 25,
    status: "Resolved",
    description: "Scheduled security awareness drill simulated payload delivery to sales department. 3 clicks recorded.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "inc-5",
    incident_id: "INC-2026-1020",
    incident_name: "Suspicious Outbound DNS Tunneling Queries",
    severity: "Medium",
    likelihood: 0.6,
    impact: 65,
    risk_score: 39,
    status: "Investigating",
    description: "DNS logs show high volume of subdomains queried under unknown dynamic DNS provider indicative of C2 beaconing.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "inc-6",
    incident_id: "INC-2026-1004",
    incident_name: "Expired TLS Certificate on Staging Ingress",
    severity: "Low",
    likelihood: 0.3,
    impact: 30,
    risk_score: 9,
    status: "Resolved",
    description: "Automated alert for staging environment certificate renewal expiration. Certificate reissued and deployed.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
]

export const INITIAL_MALWARE_TESTS: MalwareTest[] = [
  {
    id: "mlw-1",
    file_name: "eicar_standard_test.com",
    file_size: 68,
    sha256_hash: "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f",
    detection_status: "EICAR Standard Test",
    risk_level: "Critical",
    scanner_type: "Simulated Hash & Signature Engine",
    scan_notes: "Matches European Institute for Computer Antivirus Research standard verification signature. Harmless test vector.",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "mlw-2",
    file_name: "harmless_recon_script.ps1",
    file_size: 1024,
    sha256_hash: "4a8f117a2b0e68e42718e244b413e110b98a0d0a5e229c9ef6a07cf5814bfb22",
    detection_status: "Suspicious",
    risk_level: "Medium",
    scanner_type: "Simulated Heuristic Pattern Engine",
    scan_notes: "Simulated pattern match on PowerShell obfuscation flags (e.g., -EncodedCommand, Net.WebClient).",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "mlw-3",
    file_name: "system_health_audit.log",
    file_size: 4096,
    sha256_hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    detection_status: "Clean",
    risk_level: "Clean",
    scanner_type: "Simulated Hash Verification Engine",
    scan_notes: "Cryptographic hash verified against known benign checksum baseline. Zero threats identified.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: "mlw-4",
    file_name: "sample_ransom_note.txt",
    file_size: 512,
    sha256_hash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    detection_status: "Simulated Malicious",
    risk_level: "High",
    scanner_type: "Simulated YARA Pattern Engine",
    scan_notes: "Demonstration detection matching simulated ransomware extortion keywords and payment address tokens.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
]

export const INITIAL_YARA_RULES: YaraRule[] = [
  {
    id: "yara-1",
    rule_id: "YARA-001",
    rule_name: "SUSPICIOUS_POWERSHELL_DOWNLOAD",
    description: "Demonstration rule identifying encoded PowerShell web client download executions.",
    severity: "High",
    is_active: true,
    rule_content: `rule Suspicious_PowerShell_Download {
    meta:
        description = "Detects web client download strings in scripts"
        author = "IRM SecOps"
        demonstration = "true"
    strings:
        $s1 = "DownloadString" nocase
        $s2 = "Net.WebClient" nocase
        $s3 = "-EncodedCommand" nocase
    condition:
        ($s1 and $s2) or $s3
}`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "yara-2",
    rule_id: "YARA-002",
    rule_name: "EICAR_AV_TEST_STRING",
    description: "Standard anti-virus validation signature string for harmless testing.",
    severity: "Critical",
    is_active: true,
    rule_content: `rule EICAR_Standard_Test_File {
    meta:
        description = "Industry standard anti-virus verification test string"
        reference = "https://www.eicar.org"
        demonstration = "true"
    strings:
        $eicar = "X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "yara-3",
    rule_id: "YARA-003",
    rule_name: "RANSOMWARE_NOTE_INDICATORS",
    description: "Detects common keywords present in extortion and simulated ransom notices.",
    severity: "Critical",
    is_active: true,
    rule_content: `rule Ransomware_Note_Keywords {
    meta:
        description = "Identifies extortion and decryption demand patterns"
        demonstration = "true"
    strings:
        $r1 = "all your files have been encrypted" nocase
        $r2 = "send bitcoin to" nocase
        $r3 = "decrypt your files" nocase
    condition:
        2 of ($r*)
}`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "yara-4",
    rule_id: "YARA-004",
    rule_name: "HIGH_ENTROPY_BASE64_EXEC",
    description: "Heuristic pattern for base64 encoded command arguments in process invocations.",
    severity: "Medium",
    is_active: true,
    rule_content: `rule Suspicious_Base64_Execution {
    meta:
        description = "Base64 execution patterns in CLI tools"
        demonstration = "true"
    strings:
        $b1 = "powershell -e " nocase
        $b2 = "cmd.exe /c echo " nocase
    condition:
        any of them
}`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
]

export const INITIAL_REPORTS: IncidentReport[] = [
  {
    id: "rep-1",
    incident_id: "INC-2026-1041",
    report_title: "Forensic Triage: Anomalous PowerShell Remote Download",
    risk_score: 83,
    severity: "Critical",
    analysis_result: "Confirmed unauthorized PowerShell execution attempting payload retrieval from 198.51.100.42. Matched rule YARA-001.",
    response_notes: "Workstation WS-04 isolated from VLAN 12. External staging domain sinkholed at perimeter firewall. Memory dump acquired for offline analysis.",
    generated_by: "SecOps Lead Responder",
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "rep-2",
    incident_id: "INC-2026-1039",
    report_title: "Incident Summary: Internal VPN Gateway Brute-Force",
    risk_score: 64,
    severity: "High",
    analysis_result: "Automated brute-force attack originating from external subnet against LDAP accounts. 450 attempts recorded.",
    response_notes: "Origin IP blocked on perimeter gateway rate-limiter. Enforced mandatory MFA re-challenge on 14 affected accounts. Zero credentials compromised.",
    generated_by: "Security Operations Center",
    created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
  },
  {
    id: "rep-3",
    incident_id: "INC-2026-1028",
    report_title: "Security Drill Report: Q1 Phishing Awareness Simulation",
    risk_score: 25,
    severity: "Medium",
    analysis_result: "Scheduled controlled phishing assessment drill completed. 94% report rate across targeted engineering and sales staff.",
    response_notes: "Automated remedial micro-training modules dispatched to 3 users who interacted with demonstration link.",
    generated_by: "Compliance & Security Officer",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
]

export const INITIAL_THREATS: Threat[] = [
  {
    id: "th-1",
    threat_name: "DarkGate Loader Campaign",
    threat_type: "Malware Loader",
    risk_level: "High",
    source: "CISA Advisory AA24-12",
    status: "Active",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: "th-2",
    threat_name: "CVE-2024-38063 IPv6 RCE",
    threat_type: "Vulnerability Exploit",
    risk_level: "Critical",
    source: "Microsoft Security Bulletin",
    status: "Mitigated",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  {
    id: "th-3",
    threat_name: "DNS Spoofing on External Resolver",
    threat_type: "Network Tampering",
    risk_level: "Medium",
    source: "BGP Mon / DNS Watchdog",
    status: "Monitoring",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "th-4",
    threat_name: "Credential Stuffing on SSO Portal",
    threat_type: "Identity Attack",
    risk_level: "High",
    source: "Internal SIEM Correlation",
    status: "Active",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

export const INITIAL_RESPONSE_RULES: ResponseRule[] = [
  {
    id: "rule-1",
    rule_id: "RULE-AU-01",
    rule_name: "Critical Risk Automatic Escalation",
    condition: "Risk >= 80",
    severity: "Critical",
    is_active: true,
  },
  {
    id: "rule-2",
    rule_id: "RULE-AU-02",
    rule_name: "High Risk SecOps Triage",
    condition: "Risk >= 50 AND Risk < 80",
    severity: "High",
    is_active: true,
  },
  {
    id: "rule-3",
    rule_id: "RULE-AU-03",
    rule_name: "Medium Risk Analyst Queue",
    condition: "Risk >= 20 AND Risk < 50",
    severity: "Medium",
    is_active: true,
  },
  {
    id: "rule-4",
    rule_id: "RULE-AU-04",
    rule_name: "Low Risk Automated Logging",
    condition: "Risk < 20",
    severity: "Low",
    is_active: true,
  },
]

// In-memory data store for local session persistence when Supabase is not connected
class MemoryDataStore {
  incidents: Incident[] = [...INITIAL_INCIDENTS]
  malwareTests: MalwareTest[] = [...INITIAL_MALWARE_TESTS]
  yaraRules: YaraRule[] = [...INITIAL_YARA_RULES]
  reports: IncidentReport[] = [...INITIAL_REPORTS]
  threats: Threat[] = [...INITIAL_THREATS]
  responseRules: ResponseRule[] = [...INITIAL_RESPONSE_RULES]

  getIncidents() {
    return [...this.incidents]
  }

  addIncident(incident: Incident) {
    this.incidents.unshift(incident)
    return incident
  }

  addIncidents(newIncidents: Incident[]) {
    const existingIds = new Set(this.incidents.map((i) => i.incident_id.toUpperCase()))
    const validToAdd = newIncidents.filter((i) => !existingIds.has(i.incident_id.toUpperCase()))
    this.incidents = [...validToAdd, ...this.incidents]
    return validToAdd
  }

  updateIncidentStatus(id: string, status: Incident["status"]) {
    const item = this.incidents.find((i) => i.id === id || i.incident_id === id)
    if (item) {
      item.status = status
      return true
    }
    return false
  }

  deleteIncident(id: string) {
    const idx = this.incidents.findIndex((i) => i.id === id || i.incident_id === id)
    if (idx !== -1) {
      this.incidents.splice(idx, 1)
      return true
    }
    return false
  }

  getMalwareTests() {
    return [...this.malwareTests]
  }

  addMalwareTest(test: MalwareTest) {
    this.malwareTests.unshift(test)
    return test
  }

  getYaraRules() {
    return [...this.yaraRules]
  }

  addYaraRule(rule: YaraRule) {
    this.yaraRules.unshift(rule)
    return rule
  }

  toggleYaraRule(id: string, active: boolean) {
    const rule = this.yaraRules.find((r) => r.id === id || r.rule_id === id)
    if (rule) {
      rule.is_active = active
      return true
    }
    return false
  }

  getReports() {
    return [...this.reports]
  }

  addReport(report: IncidentReport) {
    this.reports.unshift(report)
    return report
  }

  getThreats() {
    return [...this.threats]
  }

  getResponseRules() {
    return [...this.responseRules]
  }
}

// Global singleton across server invocations in development
const globalForStore = globalThis as unknown as { irmMemoryStore?: MemoryDataStore }
export const memoryStore = globalForStore.irmMemoryStore ?? new MemoryDataStore()
if (process.env.NODE_ENV !== "production") {
  globalForStore.irmMemoryStore = memoryStore
}
