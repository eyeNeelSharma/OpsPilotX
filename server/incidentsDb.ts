import fs from "fs";
import path from "path";
import { SanityCheckRun } from "../src/types";
import { db } from "../src/db/index.ts";
import { incidents } from "../src/db/schema.ts";

const INCIDENTS_DB_FILE = path.join(process.cwd(), "db_incidents.json");

const DEFAULT_INCIDENTS: SanityCheckRun[] = [
  {
    id: "run-hist-001",
    applicationId: "mifid-rates",
    applicationName: "Mifid Rates",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-10T08:15:22.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 42,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-10T08:15:22.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-10T08:15:30.000Z", level: "warn", message: "[Alice SRE] Queue MIFID.RATES.IN depth is 78,401 - EXCEEDED critical threshold.", step: "ping" },
      { timestamp: "2026-07-10T08:16:10.000Z", level: "success", message: "[Ethan SRE] Found matching historical queue clog. Recommending TCP socket reset.", step: "infra" },
      { timestamp: "2026-07-10T08:17:05.000Z", level: "success", message: "[RegOps Exec] Executed reset_regulatory_socket successfully.", step: "remediation" },
      { timestamp: "2026-07-10T08:17:15.000Z", level: "success", message: "[System] Systems reconciled. Queue depth drained.", step: "verification" }
    ],
    results: [
      {
        endpointId: "rates-queue",
        path: "/api/demo/regops/rates/queue",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 12,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - Connected and processing trade transactions successfully.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-1",
        title: "IBM MQ Queue Depth Limit Exceeded",
        severity: "high",
        endpoint: "/api/demo/regops/rates/queue",
        description: "MIFID.RATES.IN queue depth exceeded threshold due to a stale TCP socket handle blocking consumers.",
        possibleCause: "Stale socket handles on rates-tx-prod-918 daemon."
      }
    ],
    remediations: [
      {
        title: "Reset Outbound Regulatory TCP Socket Handles",
        service: "IBM MQ",
        command: "reset_regulatory_socket",
        explanation: "Re-binds the socket consumers, unblocking transmission flow immediately.",
        riskClassification: "GREEN"
      }
    ],
    executiveSummary: "MiFID Rates suffered an MQ queue bottleneck due to a stale TCP socket connection on rates-tx-prod-918. Resolved immediately via automated socket handle reset.",
    geneosAlertId: "alert_001",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h1",
        agentId: "alice",
        agentName: "Alice (SRE Recon)",
        avatar: "SRE",
        role: "SRE",
        content: "MiFID Rates queue is severely clogged at 78k deep. We need a diagnostic on why the consumer isn't consuming.",
        timestamp: "2026-07-10T08:15:35.000Z",
        step: "investigate"
      },
      {
        id: "dial-h2",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "I queried our history database. This is a recurring socket binding problem. In the past, running 'reset_regulatory_socket' immediately drained the queue with zero risk.",
        timestamp: "2026-07-10T08:15:55.000Z",
        step: "root_cause"
      }
    ],
    triggeredBy: "Sarah Jenkins (SRE)"
  },
  {
    id: "run-hist-002",
    applicationId: "mifid-credits",
    applicationName: "Mifid Credits",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-12T14:22:10.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 55,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-12T14:22:10.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-12T14:22:45.000Z", level: "warn", message: "[Bob DB] Detected exclusive table lock on MIFID_CREDIT_TRADES by SPID 892.", step: "infra" },
      { timestamp: "2026-07-12T14:23:05.000Z", level: "success", message: "[RegOps Exec] Operator approved and killed SPID 892.", step: "remediation" },
      { timestamp: "2026-07-12T14:23:20.000Z", level: "success", message: "[System] Lock released. Subscriptions caught up.", step: "verification" }
    ],
    results: [
      {
        endpointId: "credits-db",
        path: "/api/demo/regops/credits/db",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 15,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - Database writes processing successfully.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-2",
        title: "Sybase DB Exclusive Transaction Lock",
        severity: "high",
        endpoint: "/api/demo/regops/credits/db",
        description: "A long running reporting query acquired exclusive locks on MIFID_CREDIT_TRADES, starving write workers.",
        possibleCause: "Stray analytical report run directly on transactional cluster."
      }
    ],
    remediations: [
      {
        title: "Kill Blocking SPID on Sybase Cluster",
        service: "Sybase DB",
        command: "kill_blocking_spid",
        explanation: "Force kills the blocking SPID thread, instantly releasing locked reporting rows.",
        riskClassification: "AMBER"
      }
    ],
    executiveSummary: "A rogue reporting thread (SPID 892) blocked credit derivative persistence. Released instantly by killing the blocking SPID.",
    geneosAlertId: "alert_002",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h3",
        agentId: "bob",
        agentName: "Bob (Database SRE)",
        avatar: "DB",
        role: "Database",
        content: "Confirmed exclusive row locks on MIFID_CREDIT_TRADES. Blocking transaction SPID is 892.",
        timestamp: "2026-07-12T14:22:50.000Z",
        step: "root_cause"
      },
      {
        id: "dial-h4",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "Checking knowledge base... This lock has happened twice before due to standard SRE report drills. Safe AMBER resolution is running 'kill_blocking_spid' to terminate SPID 892.",
        timestamp: "2026-07-12T14:23:00.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "Marcus Vance (Principal SRE)"
  },
  {
    id: "run-hist-003",
    applicationId: "mifid-fx-cmd",
    applicationName: "Mifid FX and CMD",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-14T11:04:12.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 38,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-14T11:04:12.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-14T11:04:40.000Z", level: "warn", message: "[David SRE] ESMA Trade Repository feedback NACK rate is critically high at 12.4%.", step: "ping" },
      { timestamp: "2026-07-14T11:05:15.000Z", level: "success", message: "[Charlie SRE] Pinpointed bug to release v14.2 which omitted CFI codes.", step: "changes" },
      { timestamp: "2026-07-14T11:05:55.000Z", level: "success", message: "[David SRE] Generated hotfix Pull Request to rollback/patch code.", step: "pr_create" },
      { timestamp: "2026-07-14T11:06:10.000Z", level: "success", message: "[System] Hotfix merged. Compliance validations returned to 99.8%.", step: "verification" }
    ],
    results: [
      {
        endpointId: "fx-ack",
        path: "/api/demo/regops/fx/ack",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 18,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - Upstream captures operating within ESMA boundaries.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-3",
        title: "High ESMA Trade Repository NACK Rate",
        severity: "high",
        endpoint: "/api/demo/regops/fx/ack",
        description: "Upstream release v14.2 contained a bug omitting critical CFI (Classification of Financial Instruments) codes, triggering 12% NACK rejection rates.",
        possibleCause: "Code drift on transaction encoder service in release v14.2."
      }
    ],
    remediations: [
      {
        title: "Rollback Upstream Trade Capture Release",
        service: "Trade Router",
        command: "redeploy_upstream_release",
        explanation: "Rolls back trade-capture-engine to compliant build version.",
        riskClassification: "AMBER"
      }
    ],
    executiveSummary: "Commodity swaps were rejected by ESMA due to missing CFI codes in upstream release v14.2. Resolved by drafting and merging a rollback Pull Request.",
    geneosAlertId: "alert_003",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h5",
        agentId: "charlie",
        agentName: "Charlie (Code Arc)",
        avatar: "CODE",
        role: "Code",
        content: "I ran a diff on release v14.2. Found a line that truncates the CFI field: 'cfiCode = trade.type === Swap ? null : trade.cfiCode'. This is definitely the culprit.",
        timestamp: "2026-07-14T11:05:00.000Z",
        step: "root_cause"
      },
      {
        id: "dial-h6",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "Our incident log confirms that a similar 'CFI Code missing' anomaly happened in 2025 during an FX deployment. We solved it back then by a quick hotfix patch in pull request. I suggest David immediately drafts a patch PR.",
        timestamp: "2026-07-14T11:05:10.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "Alok Mehta (Compliance Officer)"
  },
  {
    id: "run-hist-004",
    applicationId: "target-liquidity",
    applicationName: "Target Liquidity",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-15T09:44:10.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 48,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-15T09:44:10.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-15T09:44:22.000Z", level: "warn", message: "[Alice SRE] Gateway timeout detected on LDN-liquidity edge load balancer.", step: "ping" },
      { timestamp: "2026-07-15T09:44:35.000Z", level: "info", message: "[Ethan SRE] Searched incident database. This occurs due to stale route tables.", step: "historical" },
      { timestamp: "2026-07-15T09:44:50.000Z", level: "success", message: "[RegOps Exec] Executed restart_gateway_router command.", step: "remediation" },
      { timestamp: "2026-07-15T09:45:00.000Z", level: "success", message: "[System] Gateway tables flushed. Liquidity routing active.", step: "verification" }
    ],
    results: [
      {
        endpointId: "liq-edge",
        path: "/api/demo/regops/liquidity/edge",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 14,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - LDN Edge active with 12 aggregated liquidity providers.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-4",
        title: "API Gateway Edge Timeout",
        severity: "high",
        endpoint: "/api/demo/regops/liquidity/edge",
        description: "Timeout on route resolution tables during LDN cluster core reload.",
        possibleCause: "Stale route definitions on edge router proxies."
      }
    ],
    remediations: [
      {
        title: "Restart Liquidity Edge Gateway Router",
        service: "Nginx Gateway",
        command: "restart_gateway_router",
        explanation: "Restarts the router proxy layer to clear matching cache pools.",
        riskClassification: "GREEN"
      }
    ],
    executiveSummary: "Target Liquidity lost routing due to stale edge load balancer caches. Fully mitigated via a gateway proxy restart.",
    geneosAlertId: "alert_004",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h7",
        agentId: "alice",
        agentName: "Alice (SRE Recon)",
        avatar: "SRE",
        role: "SRE",
        content: "I see 504 Gateway Timeouts from the edge proxy cluster. Bob, any DB anomalies?",
        timestamp: "2026-07-15T09:44:15.000Z",
        step: "investigate"
      },
      {
        id: "dial-h8",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "Our records show a similar gateway stall on 2026-06-18. Flashing Nginx tables resolved it immediately. I suggest running the 'restart_gateway_router' GREEN class rule.",
        timestamp: "2026-07-15T09:44:30.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "DevOps Automated Cron"
  },
  {
    id: "run-hist-005",
    applicationId: "trade-settlement",
    applicationName: "Trade Settlement",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-16T10:12:00.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 52,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-16T10:12:00.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-16T10:12:30.000Z", level: "warn", message: "[Bob DB] Trade Settlement daemon memory is at 98.4%. Possible JVM memory leak.", step: "infra" },
      { timestamp: "2026-07-16T10:12:45.000Z", level: "success", message: "[Ethan SRE] Found pattern: stale report file pointers. Recommending force garbage collection.", step: "historical" },
      { timestamp: "2026-07-16T10:13:00.000Z", level: "success", message: "[RegOps Exec] Executed force_garbage_collection successfully.", step: "remediation" },
      { timestamp: "2026-07-16T10:13:10.000Z", level: "success", message: "[System] Heap usage stabilized to 45%. System healthy.", step: "verification" }
    ],
    results: [
      {
        endpointId: "settlement-jvm",
        path: "/api/demo/regops/settlement/jvm",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 16,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - GC sweep completed. Safe memory levels maintained.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-5",
        title: "Settlement Engine Memory Leak",
        severity: "medium",
        endpoint: "/api/demo/regops/settlement/jvm",
        description: "JVM Heap exhaustion from un-garbage collected reporting stream writers.",
        possibleCause: "Stale thread pools holding file write locks."
      }
    ],
    remediations: [
      {
        title: "Force GC on Trade Settlement Cluster",
        service: "Settlement JVM",
        command: "force_garbage_collection",
        explanation: "Triggers System.gc() to drain soft/weak reporting pointers immediately.",
        riskClassification: "GREEN"
      }
    ],
    executiveSummary: "Memory leaks on the settlement engine were mitigated instantly by executing an automated JVM garbage collection run.",
    geneosAlertId: "alert_005",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h9",
        agentId: "bob",
        agentName: "Bob (Database SRE)",
        avatar: "DB",
        role: "Database",
        content: "Heap usage is spiking. We have unclosed file pointers holding database transaction handles.",
        timestamp: "2026-07-16T10:12:20.000Z",
        step: "investigate"
      },
      {
        id: "dial-h10",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "This matches an incident in Trade Settlement on 2026-05-12. In that case, triggering 'force_garbage_collection' cleared the heap without needing a daemon reboot.",
        timestamp: "2026-07-16T10:12:40.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "Automated GC Cron"
  },
  {
    id: "run-hist-006",
    applicationId: "compliance-engine",
    applicationName: "Compliance Engine",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-17T11:05:00.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 41,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-17T11:05:00.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-17T11:05:25.000Z", level: "warn", message: "[Bob DB] Postgres table COMPLIANCE_RULESET has missing columns. Schema discrepancy detected.", step: "infra" },
      { timestamp: "2026-07-17T11:05:40.000Z", level: "info", message: "[Ethan SRE] Found previous SRE migration mismatch. Recommending db migration script.", step: "historical" },
      { timestamp: "2026-07-17T11:06:05.000Z", level: "success", message: "[RegOps Exec] SRE approved migration. Executed apply_pending_migrations.", step: "remediation" },
      { timestamp: "2026-07-17T11:06:20.000Z", level: "success", message: "[System] DB Schema fully synchronized. Compliance checks operational.", step: "verification" }
    ],
    results: [
      {
        endpointId: "compliance-schema",
        path: "/api/demo/regops/compliance/schema",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 12,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - Schema matches V12 migration exactly. All columns validated.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-6",
        title: "Database Schema Discrepancy",
        severity: "high",
        endpoint: "/api/demo/regops/compliance/schema",
        description: "The rule engine is failing due to missing columns for MIFID-II transaction tracking.",
        possibleCause: "Deployment didn't trigger SQL database migrations."
      }
    ],
    remediations: [
      {
        title: "Apply Pending PostgreSQL Migrations",
        service: "Compliance Postgres",
        command: "apply_pending_migrations",
        explanation: "Runs knex/drizzle migrate command to align cluster tables.",
        riskClassification: "AMBER"
      }
    ],
    executiveSummary: "Compliance Engine crashed because database migrations didn't run with the app deployment. Synchronized schema via apply_pending_migrations.",
    geneosAlertId: "alert_006",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h11",
        agentId: "bob",
        agentName: "Bob (Database SRE)",
        avatar: "DB",
        role: "Database",
        content: "I'm seeing SQL column lookup errors on rule valuation. COMPLIANCE_RULESET table is missing 'esma_category' column.",
        timestamp: "2026-07-17T11:05:15.000Z",
        step: "investigate"
      },
      {
        id: "dial-h12",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "A similar event occurred on 2026-04-10 in Compliance Engine. The DB migration was skipped in the CI pipeline. Executing 'apply_pending_migrations' (AMBER class) resolved the discrepancy safely.",
        timestamp: "2026-07-17T11:05:35.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "SRE Deployer"
  },
  {
    id: "run-hist-007",
    applicationId: "mifid-rates",
    applicationName: "Mifid Rates",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-18T16:22:00.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 39,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-18T16:22:00.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-18T16:22:15.000Z", level: "warn", message: "[Alice SRE] Core pricing feed threads are stuck waiting on socket packets.", step: "ping" },
      { timestamp: "2026-07-18T16:22:30.000Z", level: "info", message: "[Ethan SRE] Found matching feed stuck pattern. Recommending ingest daemon reboot.", step: "historical" },
      { timestamp: "2026-07-18T16:22:45.000Z", level: "success", message: "[RegOps Exec] Executed restart_feed_ingest_daemon successfully.", step: "remediation" },
      { timestamp: "2026-07-18T16:22:55.000Z", level: "success", message: "[System] Socket packets flowing. Rates refreshed.", step: "verification" }
    ],
    results: [
      {
        endpointId: "rates-feed",
        path: "/api/demo/regops/rates/feed",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 11,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - Latency: 4ms. Pricing tickers actively streaming.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-7",
        title: "Pricing Ingest Threads Stuck",
        severity: "medium",
        endpoint: "/api/demo/regops/rates/feed",
        description: "Ingest daemon rate threads starved of socket packets due to upstream routing flap.",
        possibleCause: "Stale TCP buffers."
      }
    ],
    remediations: [
      {
        title: "Restart Rates Feed Ingest Daemon",
        service: "Tick Ingest",
        command: "restart_feed_ingest_daemon",
        explanation: "Reboots the process worker to clean buffer sockets and trigger fresh DNS resolution.",
        riskClassification: "GREEN"
      }
    ],
    executiveSummary: "Rates feed price streaming froze due to a socket lockup. Resolved safely by restarting the feed ingest daemon process.",
    geneosAlertId: "alert_007",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h13",
        agentId: "alice",
        agentName: "Alice (SRE Recon)",
        avatar: "SRE",
        role: "SRE",
        content: "Tickers are flatlining. Pricing packets aren't landing. Charlie, any git diffs?",
        timestamp: "2026-07-18T16:22:10.000Z",
        step: "investigate"
      },
      {
        id: "dial-h14",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "Checking Mifid Rates history... We had this lockup on 2026-07-10 as well. Executing 'restart_feed_ingest_daemon' is the standard green runbook. It restarts the socket reader thread safely.",
        timestamp: "2026-07-18T16:22:25.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "SRE Automated Probe"
  },
  {
    id: "run-hist-008",
    applicationId: "mifid-credits",
    applicationName: "Mifid Credits",
    applicationUrl: "http://127.0.0.1:3000",
    timestamp: "2026-07-19T02:40:00.000Z",
    overallHealthScore: 100,
    overallStatus: "HEALTHY",
    latencyAvg: 58,
    endpointsCheckedCount: 2,
    endpointsPassedCount: 2,
    logs: [
      { timestamp: "2026-07-19T02:40:00.000Z", level: "info", message: "[System SRE] Initiating investigation...", step: "recon" },
      { timestamp: "2026-07-19T02:40:20.000Z", level: "warn", message: "[Alice SRE] Credits container crashed with Exit Code 137 (OOM Killed).", step: "ping" },
      { timestamp: "2026-07-19T02:40:35.000Z", level: "info", message: "[Ethan SRE] Found historical OOM pattern. Recommending vertical JVM scale.", step: "historical" },
      { timestamp: "2026-07-19T02:40:55.000Z", level: "success", message: "[RegOps Exec] Scale resource request APPROVED. Scaling pod memory.", step: "remediation" },
      { timestamp: "2026-07-19T02:41:10.000Z", level: "success", message: "[System] Container restarted with 4G Heap limit. Memory stable.", step: "verification" }
    ],
    results: [
      {
        endpointId: "credits-heap",
        path: "/api/demo/regops/credits/db",
        method: "GET",
        status: 200,
        expectedStatus: 200,
        statusMatch: true,
        latencyMs: 18,
        headers: { "content-type": "application/json" },
        bodySnippet: "OK - JVM healthy with 42% memory allocation margin.",
        healthState: "HEALTHY"
      }
    ],
    issues: [
      {
        id: "issue-hist-8",
        title: "Credits Container Out of Memory (OOM)",
        severity: "high",
        endpoint: "/api/demo/regops/credits/db",
        description: "Pod memory hit hard limits on heavy credit calculation block, prompting GKE node agent kill.",
        possibleCause: "Insufficient cluster memory constraints on credit-broker pod."
      }
    ],
    remediations: [
      {
        title: "Scale JVM Memory Resources (AMBER)",
        service: "Kubernetes Cluster",
        command: "scale_jvm_memory_resource",
        explanation: "Modifies GKE deployment manifest to upgrade memory requests/limits limits from 2Gi to 4Gi.",
        riskClassification: "AMBER"
      }
    ],
    executiveSummary: "Credits calculations triggered an OOM-Kill (Exit Code 137). Resolved by scaling memory constraints to 4Gi in the GKE deployment specification.",
    geneosAlertId: "alert_008",
    currentStep: "completed",
    agentDialogues: [
      {
        id: "dial-h15",
        agentId: "alice",
        agentName: "Alice (SRE Recon)",
        avatar: "SRE",
        role: "SRE",
        content: "Credit container is looping. Terminal logs show 'Exit Code 137'. The kernel terminated the pod for exceeding limits.",
        timestamp: "2026-07-19T02:40:15.000Z",
        step: "investigate"
      },
      {
        id: "dial-h16",
        agentId: "ethan",
        agentName: "Ethan (Incident History Agent)",
        avatar: "KB",
        role: "Knowledge Base",
        content: "During last quarter's stress tests, Mifid Credits hit the exact same OOM wall. The approved SRE playbook is calling 'scale_jvm_memory_resource' to lift limits to 4Gi.",
        timestamp: "2026-07-19T02:40:30.000Z",
        step: "remediation"
      }
    ],
    triggeredBy: "GKE Node Agent"
  }
];

// Local cache to maintain synchronous compatibility with existing routing
let localCache: SanityCheckRun[] = [];

export async function syncCacheFromDatabase(): Promise<void> {
  try {
    const rows = await db.select().from(incidents);
    localCache = (rows as unknown as SanityCheckRun[]).sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    console.log(`[Postgres] Synced ${localCache.length} incidents to cache.`);
  } catch (err) {
    console.error("Failed to sync cache from Postgres:", err);
  }
}

export async function initDatabase(): Promise<void> {
  try {
    console.log("Initializing Postgres Database...");
    
    // Check if table is empty
    const existing = await db.select().from(incidents).limit(1);
    if (existing.length === 0) {
      console.log("Seeding empty Postgres DB with default incidents...");
      // Seed with DEFAULT_INCIDENTS
      for (const run of DEFAULT_INCIDENTS) {
        await db.insert(incidents).values({
          id: run.id,
          applicationId: run.applicationId,
          applicationName: run.applicationName,
          applicationUrl: run.applicationUrl,
          timestamp: run.timestamp,
          overallHealthScore: run.overallHealthScore,
          overallStatus: run.overallStatus,
          latencyAvg: run.latencyAvg,
          endpointsCheckedCount: run.endpointsCheckedCount,
          endpointsPassedCount: run.endpointsPassedCount,
          logs: run.logs,
          results: run.results,
          issues: run.issues,
          remediations: run.remediations,
          executiveSummary: run.executiveSummary,
          geneosAlertId: run.geneosAlertId || null,
          currentStep: run.currentStep,
          agentDialogues: run.agentDialogues,
          pullRequest: run.pullRequest || null,
          triggeredBy: run.triggeredBy || null
        });
      }
      console.log("Seeded default incidents successfully.");
    }
    
    await syncCacheFromDatabase();
  } catch (err) {
    console.error("Error during database init/seed:", err);
  }
}

export function loadHistory(): SanityCheckRun[] {
  return localCache;
}

export function saveHistory(history: SanityCheckRun[]): void {
  localCache = [...history];
  
  // Asynchronously save to database
  (async () => {
    try {
      await db.delete(incidents);
      for (const run of history) {
        await db.insert(incidents).values({
          id: run.id,
          applicationId: run.applicationId,
          applicationName: run.applicationName,
          applicationUrl: run.applicationUrl,
          timestamp: run.timestamp,
          overallHealthScore: run.overallHealthScore,
          overallStatus: run.overallStatus,
          latencyAvg: run.latencyAvg,
          endpointsCheckedCount: run.endpointsCheckedCount,
          endpointsPassedCount: run.endpointsPassedCount,
          logs: run.logs,
          results: run.results,
          issues: run.issues,
          remediations: run.remediations,
          executiveSummary: run.executiveSummary,
          geneosAlertId: run.geneosAlertId || null,
          currentStep: run.currentStep,
          agentDialogues: run.agentDialogues,
          pullRequest: run.pullRequest || null,
          triggeredBy: run.triggeredBy || null
        });
      }
    } catch (err) {
      console.error("Async saveHistory failed in Postgres:", err);
    }
  })();
}

export function addHistory(run: SanityCheckRun): void {
  const index = localCache.findIndex(r => r.id === run.id);
  if (index !== -1) {
    localCache[index] = run;
  } else {
    localCache.unshift(run);
  }
  
  // Asynchronously upsert to database
  (async () => {
    try {
      await db.insert(incidents).values({
        id: run.id,
        applicationId: run.applicationId,
        applicationName: run.applicationName,
        applicationUrl: run.applicationUrl,
        timestamp: run.timestamp,
        overallHealthScore: run.overallHealthScore,
        overallStatus: run.overallStatus,
        latencyAvg: run.latencyAvg,
        endpointsCheckedCount: run.endpointsCheckedCount,
        endpointsPassedCount: run.endpointsPassedCount,
        logs: run.logs,
        results: run.results,
        issues: run.issues,
        remediations: run.remediations,
        executiveSummary: run.executiveSummary,
        geneosAlertId: run.geneosAlertId || null,
        currentStep: run.currentStep,
        agentDialogues: run.agentDialogues,
        pullRequest: run.pullRequest || null,
        triggeredBy: run.triggeredBy || null
      }).onConflictDoUpdate({
        target: incidents.id,
        set: {
          applicationId: run.applicationId,
          applicationName: run.applicationName,
          applicationUrl: run.applicationUrl,
          timestamp: run.timestamp,
          overallHealthScore: run.overallHealthScore,
          overallStatus: run.overallStatus,
          latencyAvg: run.latencyAvg,
          endpointsCheckedCount: run.endpointsCheckedCount,
          endpointsPassedCount: run.endpointsPassedCount,
          logs: run.logs,
          results: run.results,
          issues: run.issues,
          remediations: run.remediations,
          executiveSummary: run.executiveSummary,
          geneosAlertId: run.geneosAlertId || null,
          currentStep: run.currentStep,
          agentDialogues: run.agentDialogues,
          pullRequest: run.pullRequest || null,
          triggeredBy: run.triggeredBy || null
        }
      });
    } catch (err) {
      console.error("Async addHistory failed in Postgres:", err);
    }
  })();
}

