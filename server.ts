import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { 
  ApplicationProfile, 
  SanityCheckRun, 
  EndpointCheckResult, 
  AgentLog, 
  SanityIssue, 
  GCPRemediationStep 
} from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lazily initialize Gemini SDK to prevent startup crashes if GEMINI_API_KEY is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// In-Memory Database for demonstration, themed for RegOps
let applications: ApplicationProfile[] = [
  {
    id: "mifid-rates",
    name: "Mifid Rates",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "MiFID II Interest Rates and Bond trade reporting engine. Submits daily trades to ESMA and handles ACK/NACK responses.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "GKE",
    checkEndpoints: [
      {
        id: "rates-queue",
        path: "/api/demo/regops/rates/queue",
        method: "GET",
        expectedStatus: 200,
        description: "Validate IBM MQ Queue 'MIFID.RATES.IN' depth and message consumer health."
      },
      {
        id: "rates-db",
        path: "/api/demo/regops/rates/db",
        method: "GET",
        expectedStatus: 200,
        description: "Check Sybase Rates reporting database liveness and active connection counts."
      }
    ]
  },
  {
    id: "mifid-credits",
    name: "Mifid Credits",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "MiFID II Credit Derivatives and Corporate Bond trade regulatory reporting processor. Processes CDS trade matching.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "GKE",
    checkEndpoints: [
      {
        id: "credits-queue",
        path: "/api/demo/regops/credits/queue",
        method: "GET",
        expectedStatus: 200,
        description: "Check inbound trade stream MQ queue depth."
      },
      {
        id: "credits-db",
        path: "/api/demo/regops/credits/db",
        method: "GET",
        expectedStatus: 200,
        description: "Verify Sybase database transaction locks and connection limits."
      }
    ]
  },
  {
    id: "mifid-fx-cmd",
    name: "Mifid FX and CMD",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "Foreign Exchange (FX) and Commodities trade regulatory reporting gateway. Feeds central Trade Repositories.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "Cloud Run",
    checkEndpoints: [
      {
        id: "fx-queue",
        path: "/api/demo/regops/fx/queue",
        method: "GET",
        expectedStatus: 200,
        description: "Check active trade feed broker health."
      },
      {
        id: "fx-ack",
        path: "/api/demo/regops/fx/ack",
        method: "GET",
        expectedStatus: 200,
        description: "Verify ACK/NACK status code parsing thresholds."
      }
    ]
  },
  {
    id: "mmsr",
    name: "MMSR",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "Money Market Statistical Reporting Engine. Prepares daily trade file submissions for secure transmission to the ECB (European Central Bank).",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "Unknown",
    checkEndpoints: [
      {
        id: "mmsr-queue",
        path: "/api/demo/regops/mmsr/queue",
        method: "GET",
        expectedStatus: 200,
        description: "Check secure connection parameters to ECB SFTP gateway 'sftp.ecb.europa.eu'."
      },
      {
        id: "mmsr-db",
        path: "/api/demo/regops/mmsr/db",
        method: "GET",
        expectedStatus: 200,
        description: "Verify daily money market ledger transaction log database connection."
      }
    ]
  },
  {
    id: "dbtrace",
    name: "DBTrace",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "Transaction Traceability Log Server. Indexes matching transaction IDs, payloads, and compliance ACK/NACK histories.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "Compute Engine",
    checkEndpoints: [
      {
        id: "dbtrace-indexer",
        path: "/api/demo/regops/dbtrace/indexer",
        method: "GET",
        expectedStatus: 200,
        description: "Validate trade trace log collection index backlog size."
      },
      {
        id: "dbtrace-store",
        path: "/api/demo/regops/dbtrace/store",
        method: "GET",
        expectedStatus: 200,
        description: "Verify archival logs compliance cluster elasticsearch storage status."
      }
    ]
  },
  {
    id: "db-exman",
    name: "DB Exman",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "Regulatory Exceptions Management Workflow Dashboard. Coordinates compliance officer override actions on trade reporting failures.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "GKE",
    checkEndpoints: [
      {
        id: "exman-db",
        path: "/api/demo/regops/exman/db",
        method: "GET",
        expectedStatus: 200,
        description: "Check central Exception Store JVM memory metrics and database connectivity."
      },
      {
        id: "exman-ui",
        path: "/api/demo/regops/exman/ui",
        method: "GET",
        expectedStatus: 200,
        description: "Check administrative API gateway routing health."
      }
    ]
  }
];

// Geneos alerts state
let geneosAlerts = [
  {
    id: "alert_001",
    systemName: "mifid-rates-reporting-engine",
    severity: "CRITICAL",
    ruleName: "MQ_QUEUE_DEPTH_LIMIT",
    parameter: "MIFID.RATES.IN depth",
    value: "78,401 msgs (Limit: 50,000)",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "mifid-rates"
  },
  {
    id: "alert_002",
    systemName: "mifid-credits-db-cluster",
    severity: "CRITICAL",
    ruleName: "SYBASE_DB_TX_LOCK",
    parameter: "MIFID_CREDIT_TRADES lock duration",
    value: "320s (Limit: 30s)",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "mifid-credits"
  },
  {
    id: "alert_003",
    systemName: "mifid-fx-router",
    severity: "CRITICAL",
    ruleName: "ESMA_NACK_SPIKE",
    parameter: "NACK rate (ERR-VAL-509)",
    value: "12.4% (Limit: 1.0%)",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "mifid-fx-cmd"
  },
  {
    id: "alert_004",
    systemName: "ecb-mmsr-egress",
    severity: "WARNING",
    ruleName: "ECB_GATEWAY_TIMEOUT",
    parameter: "sftp.ecb.europa.eu liveness",
    value: "TIMEOUT",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "mmsr"
  },
  {
    id: "alert_005",
    systemName: "dbtrace-indexer-service",
    severity: "WARNING",
    ruleName: "INDEXER_LAG_DETECTED",
    parameter: "Log Index Lag",
    value: "15,200 records behind",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "dbtrace"
  },
  {
    id: "alert_006",
    systemName: "db-exman-portal-api",
    severity: "CRITICAL",
    ruleName: "EXMAN_DB_OUT_OF_MEMORY",
    parameter: "JVM Heap Utilization",
    value: "98.7% Heap Occupied",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "db-exman"
  }
];

let checkHistory: SanityCheckRun[] = [];

// ==================== REGOPS PERSISTENT DATABASE / MCP MIDDLEWARE ====================
const MCP_DB_PATH = path.join(process.cwd(), "db_mcp_resources.json");

function loadMcpDb() {
  try {
    if (fs.existsSync(MCP_DB_PATH)) {
      const data = fs.readFileSync(MCP_DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading MCP database:", err);
  }
  // Default structure fallback
  return {
    queues: {
      "MIFID.RATES.IN": {
        name: "MIFID.RATES.IN",
        depth: 78401,
        threshold: 50000,
        status: "STUCK",
        socketState: "STALE",
        socketId: "rates-tx-prod-918",
        description: "IBM MQ transmission buffer queue for outbound MiFID II rates trade messages."
      }
    },
    locks: {
      "MIFID_CREDIT_TRADES": {
        tableName: "MIFID_CREDIT_TRADES",
        lockType: "EXCLUSIVE",
        durationSeconds: 320,
        blockingSpid: 892,
        blockedTradesCount: 1402,
        query: "SELECT * FROM MIFID_CREDIT_TRADES HOLDLOCK WHERE trade_status = 'PENDING'",
        status: "BLOCKED"
      }
    },
    validation: {
      "esma_regulatory": {
        system: "upstream-trade-capture-engine",
        version: "v14.2",
        nackRate: "12.4%",
        bugActive: true,
        mostCommonError: "ERR-VAL-509: Missing or Invalid CFI Code on commodity swap trades.",
        description: "Compliance validation rejected. ESMA Trade Repository feedback engine."
      }
    },
    sftp: {
      "ecb_gateway": {
        host: "sftp.ecb.europa.eu",
        status: "TIMEOUT",
        routeIp: "192.168.42.11",
        gatewayDns: "unresolved",
        vlanId: 124,
        description: "European Central Bank Money Market Statistical Reporting secure transmission node."
      }
    },
    jvm: {
      "exman_db": {
        serviceId: "db-exman",
        heapUsagePercent: 98.7,
        maxMemoryMB: 4096,
        garbageCollectionTimePercent: 94.1,
        status: "OUT_OF_MEMORY",
        description: "Exception Store database driver JVM container resource limits."
      }
    },
    mcp_logs: []
  };
}

function saveMcpDb(db: any) {
  try {
    fs.writeFileSync(MCP_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing MCP database:", err);
  }
}

function addMcpLog(method: string, request: any, response: any) {
  const db = loadMcpDb();
  db.mcp_logs = db.mcp_logs || [];
  db.mcp_logs.unshift({
    id: `mcp-tx-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    method,
    request,
    response
  });
  // Keep only last 150 transaction logs
  if (db.mcp_logs.length > 150) {
    db.mcp_logs = db.mcp_logs.slice(0, 150);
  }
  saveMcpDb(db);
}

// ==================== MODEL CONTEXT PROTOCOL (MCP) PROTOCOL SERVER ENDPOINT ====================
// Implements 100% real JSON-RPC 2.0 based protocol for listing and calling tools/resources

app.get("/api/mcp/logs", (req, res) => {
  const db = loadMcpDb();
  res.json(db.mcp_logs || []);
});

app.post("/api/mcp/reset-logs", (req, res) => {
  const db = loadMcpDb();
  db.mcp_logs = [];
  saveMcpDb(db);
  res.json({ success: true });
});

app.post("/api/mcp", (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== "2.0") {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request: Only JSON-RPC 2.0 is supported." },
      id: id || null
    });
    return;
  }

  const db = loadMcpDb();

  if (method === "tools/list") {
    const responseData = {
      tools: [
        {
          name: "inspect_ibm_mq_queue",
          description: "Inspect depth, threshold rules, and socket connection states for a target IBM MQ queue.",
          inputSchema: {
            type: "object",
            properties: {
              queueName: { type: "string", description: "Name of the target IBM MQ queue (e.g. MIFID.RATES.IN)" }
            },
            required: ["queueName"]
          }
        },
        {
          name: "query_sybase_locks",
          description: "Check active Sybase database exclusive transaction table locks and blocking SPID threads.",
          inputSchema: {
            type: "object",
            properties: {
              tableName: { type: "string", description: "Name of the database reporting table to audit (e.g. MIFID_CREDIT_TRADES)" }
            },
            required: ["tableName"]
          }
        },
        {
          name: "fetch_sftp_routes",
          description: "Perform diagnostic trace and secure gateway routes lookup to the European Central Bank SFTP server.",
          inputSchema: {
            type: "object",
            properties: {
              gatewayHost: { type: "string", description: "Target gateway host (e.g. sftp.ecb.europa.eu)" }
            },
            required: ["gatewayHost"]
          }
        },
        {
          name: "fetch_compliance_metrics",
          description: "Fetch live regulatory feedback NACK rates, upstream capture versions, and validation exceptions.",
          inputSchema: {
            type: "object",
            properties: {
              system: { type: "string", description: "The upstream reporting system code (e.g. upstream-trade-capture-engine)" }
            },
            required: ["system"]
          }
        },
        {
          name: "inspect_jvm_heap",
          description: "Inspect target container driver JVM Heap metrics and garbage collection latency states.",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: { type: "string", description: "Exception Store container service ID (e.g. db-exman)" }
            },
            required: ["serviceId"]
          }
        },
        {
          name: "reset_regulatory_socket",
          description: "Reset stale TCP socket handles for the transmission daemon to restart the MQ consumer loop.",
          inputSchema: {
            type: "object",
            properties: {
              queueName: { type: "string" },
              socketId: { type: "string" }
            },
            required: ["queueName", "socketId"]
          }
        },
        {
          name: "kill_blocking_spid",
          description: "Execute high-privilege KILL statement on blocking SPID to release active Sybase exclusive table locks.",
          inputSchema: {
            type: "object",
            properties: {
              spid: { type: "number" }
            },
            required: ["spid"]
          }
        },
        {
          name: "redeploy_upstream_release",
          description: "Trigger automated rollback of upstream trade-capture engine to standard compliant version.",
          inputSchema: {
            type: "object",
            properties: {
              systemName: { type: "string" },
              targetVersion: { type: "string" }
            },
            required: ["systemName", "targetVersion"]
          }
        },
        {
          name: "fix_sftp_dns_routes",
          description: "Rebuild static route tables and bind secure DNS on K8s VLAN 124 gateway to resolve ECB gateway timeouts.",
          inputSchema: {
            type: "object",
            properties: {
              gatewayHost: { type: "string" },
              vlanId: { type: "number" }
            },
            required: ["gatewayHost", "vlanId"]
          }
        },
        {
          name: "restart_jvm_container",
          description: "Restart memory-leaking container driver pools to clear JVM Heap OutOfMemory states.",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: { type: "string" }
            },
            required: ["serviceId"]
          }
        }
      ]
    };
    addMcpLog("tools/list", params || {}, responseData);
    res.json({ jsonrpc: "2.0", result: responseData, id });
    return;
  }

  if (method === "resources/list") {
    const responseData = {
      resources: [
        {
          uri: "mcp://mifid-rates/ibm-mq-logs",
          name: "IBM MQ rates-tx-prod daemon connection logs",
          mimeType: "text/plain",
          description: "Internal socket buffer and handshake traces of the Rates outbound queues."
        },
        {
          uri: "mcp://mifid-credit/sybase-active-spids",
          name: "Sybase DB locks and thread tables",
          mimeType: "application/json",
          description: "Full active thread, lock, and SPID records for credit risk schemas."
        },
        {
          uri: "mcp://mmsr/ecb-sftp-vlan",
          name: "MMSR ECB gateway VLAN secure routes",
          mimeType: "text/plain",
          description: "Network firewall static routes and DNS records of VLAN 124."
        },
        {
          uri: "mcp://compliance/esma-feedbacks",
          name: "ESMA feedback validation logs",
          mimeType: "application/json",
          description: "Feedbacks containing validation error codes and repository responses."
        }
      ]
    };
    addMcpLog("resources/list", params || {}, responseData);
    res.json({ jsonrpc: "2.0", result: responseData, id });
    return;
  }

  if (method === "resources/read") {
    const { uri } = params || {};
    let contentText = "";

    if (uri === "mcp://mifid-rates/ibm-mq-logs") {
      const q = db.queues["MIFID.RATES.IN"];
      if (q.status === "STUCK") {
        contentText = `[INFO] rates-tx-prod-918: Opening MQ queue MIFID.RATES.IN...
[WARN] rates-tx-prod-918: TCP socket handshake delayed from peer node (192.168.12.91).
[ERROR] rates-tx-prod-918: Socket closed by peer. Connection pool exhausted.
[FATAL] rates-tx-prod-918: Stale TCP socket handle detected for transmission daemon. Halting consumer transmission loop. Queue depth rising! (Current Depth: ${q.depth})`;
      } else {
        contentText = `[INFO] rates-tx-prod-918: Opening MQ queue MIFID.RATES.IN...
[INFO] rates-tx-prod-918: TCP socket handshake established successfully.
[INFO] rates-tx-prod-918: Transmitted 504 messages. Queue consumer running healthy. (Current Depth: ${q.depth})`;
      }
    } else if (uri === "mcp://mifid-credit/sybase-active-spids") {
      contentText = JSON.stringify(db.locks, null, 2);
    } else if (uri === "mcp://mmsr/ecb-sftp-vlan") {
      const s = db.sftp["ecb_gateway"];
      if (s.status === "TIMEOUT") {
        contentText = `Destination: ${s.host}
Route IP: ${s.routeIp}
Secure VLAN ID: ${s.vlanId}
DNS Resolution: ${s.gatewayDns.toUpperCase()} (ERROR: Host sftp.ecb.europa.eu could not be resolved)
Ping Latency: 100% Packet Loss (Connection Timed Out)`;
      } else {
        contentText = `Destination: ${s.host}
Route IP: ${s.routeIp}
Secure VLAN ID: ${s.vlanId}
DNS Resolution: RESOLVED
Ping Latency: 22ms (0% Packet Loss - Connection Healthy)`;
      }
    } else if (uri === "mcp://compliance/esma-feedbacks") {
      contentText = JSON.stringify(db.validation, null, 2);
    } else {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32602, message: `Resource not found with URI: ${uri}` },
        id
      });
      return;
    }

    const responseData = {
      content: [
        {
          uri,
          mimeType: uri.endsWith("logs") || uri.endsWith("vlan") ? "text/plain" : "application/json",
          text: contentText
        }
      ]
    };
    addMcpLog("resources/read", params || {}, responseData);
    res.json({ jsonrpc: "2.0", result: responseData, id });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    let resultPayload: any = null;

    if (name === "inspect_ibm_mq_queue") {
      const q = db.queues["MIFID.RATES.IN"];
      resultPayload = {
        queueName: q.name,
        depth: q.depth,
        threshold: q.threshold,
        status: q.status,
        socketState: q.socketState,
        socketId: q.socketId,
        message: `IBM MQ queue ${q.name} is currently ${q.status}. Current depth is ${q.depth} against threshold ${q.threshold}. Socket state is ${q.socketState}.`
      };
    } else if (name === "query_sybase_locks") {
      const l = db.locks["MIFID_CREDIT_TRADES"];
      resultPayload = {
        tableName: l.tableName,
        lockType: l.lockType,
        durationSeconds: l.durationSeconds,
        blockingSpid: l.blockingSpid,
        blockedTradesCount: l.blockedTradesCount,
        query: l.query,
        status: l.status,
        message: l.status === "BLOCKED" 
          ? `Exclusive exclusive block detected on table MIFID_CREDIT_TRADES. Blocking SPID is ${l.blockingSpid} holding lock for ${l.durationSeconds}s. ${l.blockedTradesCount} transactions pending.` 
          : "Sybase DB is healthy. No blocking active transaction locks detected."
      };
    } else if (name === "fetch_sftp_routes") {
      const s = db.sftp["ecb_gateway"];
      resultPayload = {
        host: s.host,
        status: s.status,
        routeIp: s.routeIp,
        gatewayDns: s.gatewayDns,
        vlanId: s.vlanId,
        message: s.status === "TIMEOUT" 
          ? `ECB secure SFTP gateway connection timed out. DNS resolution: ${s.gatewayDns.toUpperCase()}. Network route is inaccessible.` 
          : "ECB secure SFTP gateway is connected and healthy."
      };
    } else if (name === "fetch_compliance_metrics") {
      const v = db.validation["esma_regulatory"];
      resultPayload = {
        systemName: v.system,
        version: v.version,
        nackRate: v.nackRate,
        bugActive: v.bugActive,
        mostCommonError: v.mostCommonError,
        message: v.bugActive 
          ? `ESMA trade repository reporting NACK rate is ${v.nackRate} due to code bug in release ${v.version}. Rejections due to: ${v.mostCommonError}` 
          : `ESMA reporting is healthy. Version ${v.version} active, NACK rate is ${v.nackRate}.`
      };
    } else if (name === "inspect_jvm_heap") {
      const j = db.jvm["exman_db"];
      resultPayload = {
        serviceId: j.serviceId,
        heapUsagePercent: j.heapUsagePercent,
        maxMemoryMB: j.maxMemoryMB,
        garbageCollectionTimePercent: j.garbageCollectionTimePercent,
        status: j.status,
        message: j.status === "OUT_OF_MEMORY" 
          ? `JVM heap exhausted (${j.heapUsagePercent}%) for exception store database driver. Garbage collection cycle taking ${j.garbageCollectionTimePercent}% of CPU capacity.` 
          : "Exception Store DB driver JVM container resources are running normally."
      };
    } else if (name === "reset_regulatory_socket") {
      db.queues["MIFID.RATES.IN"].depth = 104;
      db.queues["MIFID.RATES.IN"].status = "HEALTHY";
      db.queues["MIFID.RATES.IN"].socketState = "CONNECTED";
      saveMcpDb(db);
      resultPayload = {
        success: true,
        message: "MCP executed RESET_REGULATORY_SOCKET successfully. Stale socket handles for transmission daemon reset. Queue MIFID.RATES.IN drained."
      };
    } else if (name === "kill_blocking_spid") {
      db.locks["MIFID_CREDIT_TRADES"].status = "RELEASED";
      db.locks["MIFID_CREDIT_TRADES"].blockedTradesCount = 0;
      db.locks["MIFID_CREDIT_TRADES"].durationSeconds = 0;
      db.locks["MIFID_CREDIT_TRADES"].blockingSpid = 0;
      saveMcpDb(db);
      resultPayload = {
        success: true,
        message: "MCP executed KILL_BLOCKING_SPID for SPID 892 successfully. Exclusive lock on table MIFID_CREDIT_TRADES released."
      };
    } else if (name === "redeploy_upstream_release") {
      db.validation["esma_regulatory"].bugActive = false;
      db.validation["esma_regulatory"].nackRate = "0.15%";
      db.validation["esma_regulatory"].version = "v14.1";
      saveMcpDb(db);
      resultPayload = {
        success: true,
        message: "MCP executed REDEPLOY_UPSTREAM_RELEASE successfully. Reverted upstream engine to v14.1. Compliance validations restored."
      };
    } else if (name === "fix_sftp_dns_routes") {
      db.sftp["ecb_gateway"].status = "CONNECTED";
      db.sftp["ecb_gateway"].gatewayDns = "resolved";
      saveMcpDb(db);
      resultPayload = {
        success: true,
        message: "MCP executed FIX_SFTP_DNS_ROUTES successfully. Configured static route tables and resolved ECB secure DNS gateway."
      };
    } else if (name === "restart_jvm_container") {
      db.jvm["exman_db"].heapUsagePercent = 38.4;
      db.jvm["exman_db"].status = "RUNNING";
      db.jvm["exman_db"].garbageCollectionTimePercent = 1.2;
      saveMcpDb(db);
      resultPayload = {
        success: true,
        message: "MCP executed RESTART_JVM_CONTAINER successfully. Exception Store JVM container restarted, clearing Heap OOM states."
      };
    } else {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32601, message: `Tool not found: ${name}` },
        id
      });
      return;
    }

    const responseData = {
      content: [
        {
          type: "text",
          text: typeof resultPayload === "string" ? resultPayload : JSON.stringify(resultPayload)
        }
      ]
    };
    addMcpLog("tools/call", params || {}, responseData);
    res.json({ jsonrpc: "2.0", result: responseData, id });
    return;
  }

  res.status(404).json({
    jsonrpc: "2.0",
    error: { code: -32601, message: `Method not found: ${method}` },
    id
  });
});

// ==================== REGOPS SIMULATION ROUTE ENDPOINTS ====================
// Dynamically connected to the persistent MCP resources database cluster

app.get("/api/demo/regops/state", (req, res) => {
  const db = loadMcpDb();
  res.status(200).json({
    queues: db.queues["MIFID.RATES.IN"],
    locks: db.locks["MIFID_CREDIT_TRADES"],
    validation: db.validation["esma_regulatory"]
  });
});

app.get("/api/demo/regops/credit/locks", (req, res) => {
  const db = loadMcpDb();
  res.status(200).json(db.locks["MIFID_CREDIT_TRADES"]);
});

app.get("/api/demo/regops/compliance/validation", (req, res) => {
  const db = loadMcpDb();
  res.status(200).json(db.validation["esma_regulatory"]);
});

app.get("/api/demo/regops/rates/queue", (req, res) => {
  const db = loadMcpDb();
  const q = db.queues["MIFID.RATES.IN"];
  if (q.status === "STUCK") {
    res.status(503).send(
      `Error 503 (Service Unavailable): IBM MQ Queue 'MIFID.RATES.IN' depth exceeded critical threshold of 50,000 (Current: ${q.depth} msgs). ` +
      `Detail: Transmission daemon '${q.socketId}' has stale TCP socket handles. Restarting the pod or resetting the MQ connection pool is required.`
    );
  } else {
    res.status(200).json({ status: "healthy", depth: q.depth, threshold: q.threshold, socketState: q.socketState });
  }
});

app.get("/api/demo/regops/rates/db", (req, res) => {
  res.status(200).json({ status: "healthy", activeConnections: 142, maxPoolSize: 500 });
});

app.get("/api/demo/regops/credits/queue", (req, res) => {
  res.status(200).json({ status: "healthy", backlogSize: 104, timestamp: new Date().toISOString() });
});

app.get("/api/demo/regops/credits/db", (req, res) => {
  const db = loadMcpDb();
  const l = db.locks["MIFID_CREDIT_TRADES"];
  if (l.status === "BLOCKED") {
    res.status(500).send(
      `Error 500 (Internal Server Error): Sybase Database exclusive transaction table lock detected on 'MIFID_CREDIT_TRADES' by SPID ${l.blockingSpid}. ` +
      `Lock held duration: ${l.durationSeconds} seconds (Limit: 30s). Blocked transactions: ${l.blockedTradesCount} trades pending. Root Cause: Long-running uncommitted manual reconciliation batch.`
    );
  } else {
    res.status(200).json({ status: "healthy", message: "No active database locks detected." });
  }
});

app.get("/api/demo/regops/fx/queue", (req, res) => {
  res.status(200).json({ status: "healthy", queueStatus: "active", latencyMs: 12 });
});

app.get("/api/demo/regops/fx/ack", (req, res) => {
  const db = loadMcpDb();
  const v = db.validation["esma_regulatory"];
  if (v.bugActive) {
    res.status(422).send(
      `Error 422 (Unprocessable Entity): Compliance validation rejected. ESMA Trade Repository NACK rate is ${v.nackRate} (Threshold: <1.0%). ` +
      `Most common rejection code: '${v.mostCommonError}' Root Cause: Upstream trade-capture engine bug in release ${v.version}.`
    );
  } else {
    res.status(200).json({ status: "healthy", version: v.version, nackRate: v.nackRate });
  }
});

app.get("/api/demo/regops/mmsr/queue", (req, res) => {
  const db = loadMcpDb();
  const s = db.sftp["ecb_gateway"];
  if (s.status === "TIMEOUT") {
    res.status(504).send(
      `Error 504 (Gateway Timeout): Connection to ECB (European Central Bank) SFTP regulatory gateway '${s.host}' timed out after 30,000ms. ` +
      `Transmission daemon is active but unable to resolve routes. Please check the network route, proxy configuration, or firewall rules on secure VLAN ${s.vlanId}.`
    );
  } else {
    res.status(200).json({ status: "healthy", message: "Successfully connected to ECB secure sftp gateway over VLAN." });
  }
});

app.get("/api/demo/regops/mmsr/db", (req, res) => {
  res.status(200).json({ status: "healthy", partitionName: "PART_2026_07", readDelayMs: 4 });
});

app.get("/api/demo/regops/dbtrace/indexer", (req, res) => {
  res.status(200).json({ status: "warning", indexLag: 15200, isIndexing: true });
});

app.get("/api/demo/regops/dbtrace/store", (req, res) => {
  res.status(200).json({ status: "healthy", elasticHealth: "green", docCount: 48912401 });
});

app.get("/api/demo/regops/exman/db", (req, res) => {
  const db = loadMcpDb();
  const j = db.jvm["exman_db"];
  if (j.status === "OUT_OF_MEMORY") {
    res.status(503).send(
      `Error 503 (Service Unavailable): Exception Store DB connection driver failed with JVM Heap OutOfMemoryError. ` +
      `Heap utilization: ${j.heapUsagePercent}% (Max: ${j.maxMemoryMB}MB). Active garbage collection taking ${j.garbageCollectionTimePercent}% of CPU capacity. Portal UI is currently unresponsive.`
    );
  } else {
    res.status(200).json({ status: "healthy", heapUsagePercent: j.heapUsagePercent, containerState: j.status });
  }
});

app.get("/api/demo/regops/exman/ui", (req, res) => {
  res.status(200).json({ status: "healthy", activeUsers: 14 });
});


// ==================== APPLICATION PROFILES API ====================

app.get("/api/applications", (req, res) => {
  res.json(applications);
});

app.post("/api/applications", (req, res) => {
  const { id, name, url, description, checkEndpoints, deploymentPlatform, githubRepository, githubToken } = req.body;
  
  if (!name || !url) {
    res.status(400).json({ error: "Name and URL are required." });
    return;
  }

  // Format URL nicely
  let formattedUrl = url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = "http://" + formattedUrl;
  }

  if (id) {
    // Edit existing
    const index = applications.findIndex(app => app.id === id);
    if (index !== -1) {
      applications[index] = {
        ...applications[index],
        name,
        url: formattedUrl,
        description: description || "",
        deploymentPlatform: deploymentPlatform || "Unknown",
        checkEndpoints: checkEndpoints || [],
        githubRepository,
        githubToken
      };
      res.json(applications[index]);
    } else {
      res.status(404).json({ error: "Application not found." });
    }
  } else {
    // Create new
    const newApp: ApplicationProfile = {
      id: "app_" + Math.random().toString(36).substring(2, 9),
      name,
      url: formattedUrl,
      description: description || "",
      deploymentPlatform: deploymentPlatform || "Unknown",
      createdAt: new Date().toISOString(),
      checkEndpoints: checkEndpoints || [],
      githubRepository,
      githubToken
    };
    applications.push(newApp);
    res.status(201).json(newApp);
  }
});

app.delete("/api/applications/:id", (req, res) => {
  const { id } = req.params;
  applications = applications.filter(app => app.id !== id);
  res.json({ success: true });
});


// ==================== HISTORY API ====================

app.get("/api/sanity-checks/history", (req, res) => {
  res.json(checkHistory);
});

app.delete("/api/sanity-checks/history/:id", (req, res) => {
  const { id } = req.params;
  checkHistory = checkHistory.filter(run => run.id !== id);
  res.json({ success: true });
});

app.post("/api/sanity-checks/history/:id/update-results", (req, res) => {
  const { id } = req.params;
  const { logs, agentDialogues } = req.body;
  const run = checkHistory.find(r => r.id === id);
  if (run) {
    run.logs = logs || [];
    run.agentDialogues = agentDialogues || [];
    res.json({ success: true, run });
  } else {
    res.status(404).json({ error: "Run not found." });
  }
});


// ==================== GENEOS ALERTS API ====================

app.get("/api/geneos/alerts", (req, res) => {
  res.json(geneosAlerts);
});

app.post("/api/geneos/alerts/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const alert = geneosAlerts.find(a => a.id === id);
  if (alert) {
    alert.status = status;
    res.json({ success: true, alert });
  } else {
    res.status(404).json({ error: "Alert not found." });
  }
});


// ==================== REMEDIATION EXECUTION API ====================
// Triggers actual Model Context Protocol (MCP) JSON-RPC tool calls based on the remediation action requested

app.post("/api/remediations/execute", (req, res) => {
  const { command, service, title, alertId, runId } = req.body;
  
  // Load database to trigger proper tool execution
  const db = loadMcpDb();
  let mcpToolName = "unknown";
  let mcpParams: any = {};
  let executionResultMessage = "";

  // Map requested SRE/RegOps remediation commands to real-time MCP Tools
  const lowerCmd = (command || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();

  if (lowerCmd.includes("rates-tx-prod-918") || lowerTitle.includes("socket") || lowerCmd.includes("reset_socket")) {
    mcpToolName = "reset_regulatory_socket";
    mcpParams = { queueName: "MIFID.RATES.IN", socketId: "rates-tx-prod-918" };
    
    db.queues["MIFID.RATES.IN"].depth = 104;
    db.queues["MIFID.RATES.IN"].status = "HEALTHY";
    db.queues["MIFID.RATES.IN"].socketState = "CONNECTED";
    executionResultMessage = "MCP RESET_REGULATORY_SOCKET executed. Stale socket handles reset. Outbound MiFID II rates queue drained to 104 msgs.";
  } else if (lowerCmd.includes("spid") || lowerCmd.includes("kill") || lowerTitle.includes("lock")) {
    mcpToolName = "kill_blocking_spid";
    mcpParams = { spid: 892 };
    
    db.locks["MIFID_CREDIT_TRADES"].status = "RELEASED";
    db.locks["MIFID_CREDIT_TRADES"].blockedTradesCount = 0;
    db.locks["MIFID_CREDIT_TRADES"].durationSeconds = 0;
    db.locks["MIFID_CREDIT_TRADES"].blockingSpid = 0;
    executionResultMessage = "MCP KILL_BLOCKING_SPID executed. SPID 892 terminated. Exclusive table locks on Sybase released, 1,402 credit records flushed.";
  } else if (lowerCmd.includes("revert") || lowerCmd.includes("deploy") || lowerCmd.includes("v14.1") || lowerTitle.includes("rollback")) {
    mcpToolName = "redeploy_upstream_release";
    mcpParams = { systemName: "upstream-trade-capture-engine", targetVersion: "v14.1" };
    
    db.validation["esma_regulatory"].bugActive = false;
    db.validation["esma_regulatory"].nackRate = "0.15%";
    db.validation["esma_regulatory"].version = "v14.1";
    executionResultMessage = "MCP REDEPLOY_UPSTREAM_RELEASE executed. Reverted trade engine to v14.1. ESMA repository validation rejections resolved.";
  } else if (lowerCmd.includes("sftp") || lowerCmd.includes("vlan") || lowerCmd.includes("dns") || lowerTitle.includes("route")) {
    mcpToolName = "fix_sftp_dns_routes";
    mcpParams = { gatewayHost: "sftp.ecb.europa.eu", vlanId: 124 };
    
    db.sftp["ecb_gateway"].status = "CONNECTED";
    db.sftp["ecb_gateway"].gatewayDns = "resolved";
    executionResultMessage = "MCP FIX_SFTP_DNS_ROUTES executed. Static routes deployed for VLAN 124. DNS gateway resolved to sftp.ecb.europa.eu.";
  } else if (lowerCmd.includes("exman") || lowerCmd.includes("heap") || lowerCmd.includes("restart") || lowerTitle.includes("memory")) {
    mcpToolName = "restart_jvm_container";
    mcpParams = { serviceId: "db-exman" };
    
    db.jvm["exman_db"].heapUsagePercent = 38.4;
    db.jvm["exman_db"].status = "RUNNING";
    db.jvm["exman_db"].garbageCollectionTimePercent = 1.2;
    executionResultMessage = "MCP RESTART_JVM_CONTAINER executed. JVM Container db-exman recycled. Garbage collection normal, Heap usage cleared to 38%.";
  }

  // Save changes to persistent db
  saveMcpDb(db);

  // Add the official JSON-RPC transaction to our MCP Log trace DB
  addMcpLog("tools/call", { name: mcpToolName, arguments: mcpParams }, {
    jsonrpc: "2.0",
    result: {
      content: [
        { type: "text", text: executionResultMessage || `Successfully executed command: ${command}` }
      ]
    }
  });

  // Resolve the corresponding Geneos alert if alertId is provided
  if (alertId) {
    const alert = geneosAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = "RESOLVED";
    }
  }

  // Update status in the history run if runId is provided
  if (runId) {
    const run = checkHistory.find(r => r.id === runId);
    if (run) {
      run.overallStatus = "HEALTHY";
      run.overallHealthScore = 100;
      run.currentStep = "completed";
      
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[RegOps Exec] Executed command via MCP Tool [${mcpToolName}]: "${command}" successfully. DB Cluster reconciled.`,
        step: "remediation"
      });
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[RegOps Exec] Verification checks PASSED. ${executionResultMessage || "System fully recovered."}`,
        step: "verification"
      });
    }
  }

  res.json({ 
    success: true, 
    message: executionResultMessage || `Action executed successfully: '${title}' on service '${service}'.`,
    details: `Executed MCP Tool: ${mcpToolName} with parameters ${JSON.stringify(mcpParams)}`
  });
});


app.post("/api/sanity-checks/run", async (req, res) => {
  const { applicationId, geneosAlertId, triggeredBy } = req.body;
  const targetApp = applications.find(a => a.id === applicationId);

  if (!targetApp) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  // 1. Mark alert as INVESTIGATING
  if (geneosAlertId) {
    const alert = geneosAlerts.find(a => a.id === geneosAlertId);
    if (alert) alert.status = "INVESTIGATING";
  }

  const runId = `run-${Date.now()}`;
  
  // Create a new run stub
  const newRun: any = {
    id: runId,
    applicationId: targetApp.id,
    applicationName: targetApp.name,
    applicationUrl: targetApp.url,
    timestamp: new Date().toISOString(),
    overallHealthScore: 0,
    overallStatus: 'CRITICAL',
    latencyAvg: 120,
    endpointsCheckedCount: targetApp.checkEndpoints.length,
    endpointsPassedCount: 0,
    logs: [],
    results: [],
    issues: [],
    remediations: [],
    executiveSummary: "",
    geneosAlertId,
    currentStep: 'review',
    agentDialogues: [],
    pullRequest: null,
    triggeredBy: triggeredBy || "System Operator"
  };

  // Evaluate dynamic results matching our database, queue and regulator gateways
  const results = targetApp.checkEndpoints.map(e => {
    let status = 200;
    let bodySnippet = "OK - Connected and processing trade transactions successfully.";
    let healthState: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';

    // Simulate specific issues if matched with active Geneos alert
    if (e.id === "rates-queue" && geneosAlertId === "alert_001") {
      status = 503;
      bodySnippet = "Error 503 (Service Unavailable): IBM MQ Queue 'MIFID.RATES.IN' depth exceeded critical threshold of 50,000 (Current: 78,401 msgs). Outbound regulatory transmission gateway 'rates-tx-prod-918' has stale TCP socket handles. Reset required.";
      healthState = 'CRITICAL';
    } else if (e.id === "credits-db" && geneosAlertId === "alert_002") {
      status = 500;
      bodySnippet = "Error 500 (Internal Server Error): Sybase Database exclusive transaction table lock detected on 'MIFID_CREDIT_TRADES' by SPID 892. Lock duration: 320 seconds. 1,402 credit trades pending persistence. Long-running manual batch blocking tables.";
      healthState = 'CRITICAL';
    } else if (e.id === "fx-ack" && geneosAlertId === "alert_003") {
      status = 422;
      bodySnippet = "Error 422 (Unprocessable Entity): Compliance validation rejected. ESMA Trade Repository NACK rate is 12.4% (Threshold: <1.0%). Code 'ERR-VAL-509: Missing or Invalid CFI Code' on commodity swap trades due to upstream capture engine release v14.2 bug.";
      healthState = 'CRITICAL';
    } else if (e.id === "mmsr-queue" && geneosAlertId === "alert_004") {
      status = 504;
      bodySnippet = "Error 504 (Gateway Timeout): Connection to ECB (European Central Bank) SFTP regulatory gateway 'sftp.ecb.europa.eu' timed out after 30,000ms. Transmission daemon active but unable to resolve ECB secure routes.";
      healthState = 'DEGRADED';
    } else if (e.id === "dbtrace-indexer" && geneosAlertId === "alert_005") {
      status = 200;
      bodySnippet = "Warning: Log indexer thread lagging by 15,200 records. Central trade compliance log storage is slow but operational.";
      healthState = 'DEGRADED';
    } else if (e.id === "exman-db" && geneosAlertId === "alert_006") {
      status = 503;
      bodySnippet = "Error 503 (Service Unavailable): Exception Store DB driver failed with JVM Heap OutOfMemoryError. Heap utilization: 98.7% (Max: 4096MB). Garbage Collection cycle taking 94.1% CPU capacity.";
      healthState = 'CRITICAL';
    }

    return {
      endpointId: e.id,
      path: e.path,
      method: e.method,
      status,
      expectedStatus: e.expectedStatus,
      statusMatch: status === e.expectedStatus,
      latencyMs: status === 200 ? Math.floor(10 + Math.random() * 40) : Math.floor(150 + Math.random() * 100),
      headers: { "content-type": "application/json" },
      bodySnippet,
      healthState
    };
  });

  const endpointsPassedCount = results.filter(r => r.statusMatch).length;
  newRun.results = results;
  newRun.endpointsPassedCount = endpointsPassedCount;

  let realGithubCommits = null;
  if (targetApp.githubRepository) {
    try {
      const ghHeaders: Record<string, string> = { "User-Agent": "OpsPilot-X" };
      if (targetApp.githubToken) {
        ghHeaders["Authorization"] = `token ${targetApp.githubToken}`;
      }
      const ghRes = await fetch(`https://api.github.com/repos/${targetApp.githubRepository}/commits`, { headers: ghHeaders });
      if (ghRes.ok) {
        const commits = await ghRes.json();
        realGithubCommits = commits.slice(0, 5).map((c: any) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author.name,
          date: c.commit.author.date
        }));
      }
    } catch (e) {
      console.error("Failed to fetch Github commits", e);
    }
  }

  try {
    const ai = getGeminiClient();

    const payload: any = {
      application: {
        name: targetApp.name,
        url: targetApp.url,
      },
      results
    };
    
    if (realGithubCommits) {
      payload.realGithubCommits = realGithubCommits;
    }

    const prompt = `You are an Autonomous OpsPilot X agent coordinating a collaborative investigation between 4 specialized agents:
1. Alice (SRE Recon): Gathers evidence, runs K8s/infrastructure queries via MCP.
2. Bob (Database): Database health, locks, query performance.
3. Charlie (Code Arc): Git commits, build configuration, PR changes.
4. David (RegOps): Compliance, security, Pull Request generation, and automated patching.

Analyze this application results payload:
${JSON.stringify(payload, null, 2)}

Important: If "realGithubCommits" is present in the payload, Charlie MUST analyze those real commits to find the potential root cause (look for suspicious commit messages), and David MUST reference the actual repository "${targetApp.githubRepository || 'unknown'}" in the drafted pull request.

Provide your output in standard JSON matching this exact schema:
{
  "overallHealthScore": number (0 to 100),
  "overallStatus": "HEALTHY" | "DEGRADED" | "CRITICAL",
  "issues": [ { "id": "...", "title": "...", "severity": "high"|"medium"|"low", "endpoint": "...", "description": "...", "possibleCause": "..." } ],
  "remediations": [ { "title": "...", "service": "...", "command": "...", "explanation": "...", "riskClassification": "GREEN"|"AMBER"|"RED" } ],
  "executiveSummary": "...",
  "agentDialogues": [ { "id": "msg-1", "agentId": "alice|bob|charlie|david", "agentName": "...", "avatar": "...", "role": "...", "content": "...", "step": "investigate|root_cause|remediation|pr_generation" } ],
  "pullRequest": {
    "id": "pr-...",
    "title": "Fix ...",
    "description": "...",
    "repository": "${targetApp.githubRepository || "frontend-repo"}",
    "branch": "fix-branch",
    "targetBranch": "main",
    "filesChanged": [ { "filename": "...", "originalCode": "...", "modifiedCode": "...", "additions": 0, "deletions": 0 } ]
  }
}
Output valid JSON only.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const aiData = JSON.parse(response.text || '{}');
    
    newRun.overallHealthScore = aiData.overallHealthScore || 0;
    newRun.overallStatus = aiData.overallStatus || "CRITICAL";
    newRun.issues = aiData.issues || [];
    newRun.remediations = aiData.remediations || [];
    newRun.executiveSummary = aiData.executiveSummary || "";
    newRun.agentDialogues = (aiData.agentDialogues || []).map((d: any) => ({ ...d, timestamp: new Date().toISOString() }));
    newRun.pullRequest = aiData.pullRequest ? { ...aiData.pullRequest, status: 'DRAFT', createdAt: new Date().toISOString() } : null;

  } catch (error) {
    console.error("Gemini AI generation failed:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const isQuotaExceeded = errMessage.toLowerCase().includes("quota") || 
                            errMessage.toLowerCase().includes("429") || 
                            errMessage.toLowerCase().includes("exhausted") || 
                            errMessage.toLowerCase().includes("limit exceeded");
    
    res.status(isQuotaExceeded ? 429 : 500).json({
      error: isQuotaExceeded 
        ? "Gemini AI Request Limit Exceeded (Quota Exhausted). Please verify your GEMINI_API_KEY in Settings > Secrets or wait and try again later."
        : "Gemini AI Request Failed.",
      details: errMessage
    });
    return;
  }

  checkHistory.unshift(newRun);
  res.json(newRun);
});


app.post("/api/pull-requests/:runId/status", async (req, res) => {
  const { runId } = req.params;
  const { status } = req.body;
  
  const run = checkHistory.find(r => r.id === runId);
  if (!run || !run.pullRequest) {
    res.status(404).json({ error: "Run or draft PR not found" });
    return;
  }

  run.pullRequest.status = status;
  
  if (status === 'APPROVED') {
    const appProfile = applications.find(a => a.id === run.applicationId);
    let isRealMerge = false;
    let prUrl = "";

    if (appProfile && appProfile.githubToken && appProfile.githubRepository) {
      try {
        const repo = appProfile.githubRepository;
        const token = appProfile.githubToken;
        const headers = {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "OpsPilot-X"
        };

        const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || "main";

        const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${defaultBranch}`, { headers });
        const refData = await refRes.json();
        const baseSha = refData.object.sha;

        const branchName = `opspilot-fix-${Date.now()}`;
        await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
        });

        const file = run.pullRequest.filesChanged[0];
        if (file) {
          const fileRes = await fetch(`https://api.github.com/repos/${repo}/contents/${file.filename}?ref=${branchName}`, { headers });
          let fileData: any = {};
          if (fileRes.ok) fileData = await fileRes.json();
          
          const contentEncoded = Buffer.from(file.modifiedCode).toString('base64');
          await fetch(`https://api.github.com/repos/${repo}/contents/${file.filename}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `OpsPilot X fix for ${file.filename}`,
              content: contentEncoded,
              sha: fileData.sha ? fileData.sha : undefined,
              branch: branchName
            })
          });
        }

        const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: run.pullRequest.title,
            body: run.pullRequest.description + "\n\n*Generated autonomously by OpsPilot X.*",
            head: branchName,
            base: defaultBranch
          })
        });
        
        if (prRes.ok) {
          const createdPr = await prRes.json();
          isRealMerge = true;
          prUrl = createdPr.html_url;
        } else {
          console.warn("Real PR creation failed:", await prRes.text());
        }
      } catch (err: any) {
        console.error("GitHub PR Creation Error:", err);
      }
    }

    if (isRealMerge) {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[PR Approval] Real GitHub Pull Request was successfully opened! View it at: ${prUrl}`,
        step: "pr_create"
      });
    } else {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[PR Approval] Pull Request #${run.pullRequest.id} has been SIMULATED as APPROVED and successfully merged into main branch!`,
        step: "pr_create"
      });
    }

    run.logs.push({
      timestamp: new Date().toISOString(),
      level: "info",
      message: `[Deployment] Automated CI/CD pipeline triggered. Rebuilding and deploying updated code to production...`,
      step: "pr_create"
    });
    run.logs.push({
      timestamp: new Date().toISOString(),
      level: "success",
      message: `[Deployment] Rollout completed successfully. System is now fully functional and healthy!`,
      step: "verification"
    });
    run.overallStatus = "HEALTHY";
    run.overallHealthScore = 100;
    run.currentStep = "completed";
    
    // Auto resolve Geneos alerts associated with the app
    const associatedAlerts = geneosAlerts.filter(a => a.associatedAppId === run.applicationId);
    associatedAlerts.forEach(a => {
      a.status = "RESOLVED";
    });
  } else {
    run.logs.push({
      timestamp: new Date().toISOString(),
      level: "warn",
      message: `[PR Decline] Pull Request #${run.pullRequest.id} was ${status} by RegOps.`,
      step: "pr_create"
    });
  }
  
  res.json({ success: true, pullRequest: run.pullRequest });
});

// ==================== REGOPS USERS PERSISTENCE DATABASE ====================
const USERS_DB_FILE = path.join(process.cwd(), "db_users.json");

interface DBUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  password?: string;
  createdAt: string;
}

const DEFAULT_USERS: DBUser[] = [
  { id: 'DB-REGOPS-928', name: 'Sarah Jenkins', role: 'Senior RegOps Analyst (IAM & Compliance)', avatar: 'SJ', password: 'db-key-signature', createdAt: new Date().toISOString() },
  { id: 'DB-SRE-104', name: 'Marcus Vance', role: 'Principal SRE (Infrastructure)', avatar: 'MV', password: 'db-key-signature', createdAt: new Date().toISOString() },
  { id: 'DB-RISK-712', name: 'Alok Mehta', role: 'Compliance & Risk Officer', avatar: 'AM', password: 'db-key-signature', createdAt: new Date().toISOString() }
];

function loadUsers(): DBUser[] {
  try {
    if (fs.existsSync(USERS_DB_FILE)) {
      const data = fs.readFileSync(USERS_DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading users database:", err);
  }
  // Fallback to default users and save them
  saveUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

function saveUsers(users: DBUser[]): void {
  try {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users database:", err);
  }
}

// Ensure database file is generated immediately on startup
loadUsers();

// Endpoint to list all users (excluding passwords)
app.get("/api/auth/users", (req, res) => {
  const users = loadUsers();
  const safeUsers = users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Endpoint for User Sign-Up
app.post("/api/auth/signup", (req, res) => {
  const { name, role, password, operatorId } = req.body;
  if (!name || !role || !password) {
    return res.status(400).json({ error: "Name, security role, and DB-Key signature password are required." });
  }

  const users = loadUsers();
  
  // Check if user already exists by name
  const nameExists = users.some(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (nameExists) {
    return res.status(400).json({ error: "An operator with this name is already registered." });
  }

  // Generate unique operator ID if not provided, or check if provided one is unique
  let assignedId = operatorId ? operatorId.trim().toUpperCase() : "";
  if (assignedId) {
    const idExists = users.some(u => u.id === assignedId);
    if (idExists) {
      return res.status(400).json({ error: "This Operator ID is already taken. Choose another or leave blank to auto-generate." });
    }
  } else {
    // Generate unique ID
    let attempts = 0;
    while (!assignedId || users.some(u => u.id === assignedId)) {
      assignedId = `DB-REGOPS-${Math.floor(100 + Math.random() * 900)}`;
      attempts++;
      if (attempts > 50) break;
    }
  }

  const initials = name.trim().split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'OP';

  const newUser: DBUser = {
    id: assignedId,
    name: name.trim(),
    role,
    avatar: initials,
    password: password,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});

// Endpoint for User Sign-In
app.post("/api/auth/signin", (req, res) => {
  const { nameOrId, password } = req.body;
  if (!nameOrId || !password) {
    return res.status(400).json({ error: "Please enter your Operator Name/ID and DB-Key Signature Password." });
  }

  const users = loadUsers();
  const searchStr = nameOrId.trim().toLowerCase();
  
  const foundUser = users.find(u => 
    u.name.toLowerCase() === searchStr || u.id.toLowerCase() === searchStr
  );

  if (!foundUser) {
    return res.status(401).json({ error: "Authentication failed: Operator name or ID not found." });
  }

  if (foundUser.password !== password) {
    return res.status(401).json({ error: "Authentication failed: Invalid security password/key signature." });
  }

  const { password: _, ...safeUser } = foundUser;
  res.json({ success: true, user: safeUser });
});

// ==================== EXPRESS SERVER BOOT / VITE MIDDLEWARE ====================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
