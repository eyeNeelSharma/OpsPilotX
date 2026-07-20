import fs from "fs";
import path from "path";

const MCP_DB_PATH = path.join(process.cwd(), "db_mcp_resources.json");

export function loadMcpDb() {
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

export function saveMcpDb(db: any) {
  try {
    fs.writeFileSync(MCP_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing MCP database:", err);
  }
}

export function addMcpLog(method: string, request: any, response: any) {
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
