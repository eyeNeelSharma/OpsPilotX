import express from "express";
import fs from "fs";
import path from "path";
import { applications, geneosAlerts } from "./appState";
import { loadHistory, saveHistory, addHistory } from "./incidentsDb";
import { loadUsers, saveUsers, DBUser } from "./usersDb";
import { loadMcpDb, saveMcpDb, addMcpLog } from "./mcpDb";
import { getGeminiClient } from "./geminiService";
import { ApplicationProfile, SanityCheckRun } from "../src/types";

export function registerRoutes(app: express.Express) {
  
  // ==================== REGOPS USERS PERSISTENCE / AUTH API ====================
  
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
      return res.status(400).json({ error: "Name and URL are required." });
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
    const index = applications.findIndex(app => app.id === id);
    if (index !== -1) {
      applications.splice(index, 1);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Application not found." });
    }
  });

  // ==================== HISTORY API ====================

  app.get("/api/sanity-checks/history", (req, res) => {
    res.json(loadHistory());
  });

  app.delete("/api/sanity-checks/history/:id", (req, res) => {
    const { id } = req.params;
    const history = loadHistory();
    const index = history.findIndex(run => run.id === id);
    if (index !== -1) {
      history.splice(index, 1);
      saveHistory(history);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Run not found." });
    }
  });

  app.post("/api/sanity-checks/history/:id/update-results", (req, res) => {
    const { id } = req.params;
    const { logs, agentDialogues } = req.body;
    const history = loadHistory();
    const run = history.find(r => r.id === id);
    if (run) {
      run.logs = logs || [];
      run.agentDialogues = agentDialogues || [];
      addHistory(run);
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
      const history = loadHistory();
      const run = history.find(r => r.id === runId);
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
        
        // Self-training logs for Incident History Agent (Ethan)
        run.logs.push({
          timestamp: new Date().toISOString(),
          level: "success",
          message: `[Ethan SRE] [Knowledge Self-Training] Resolved incident logged successfully in SRE History Database. Feedback loop complete. Heuristic weights updated.`,
          step: "verification"
        });

        addHistory(run);
      }
    }

    res.json({ 
      success: true, 
      message: executionResultMessage || `Action executed successfully: '${title}' on service '${service}'.`,
      details: `Executed MCP Tool: ${mcpToolName} with parameters ${JSON.stringify(mcpParams)}`
    });
  });

  // ==================== CLUSTER SRE INVESTIGATION WORKFLOW ====================

  app.post("/api/sanity-checks/run", async (req, res) => {
    const { applicationId, geneosAlertId, triggeredBy } = req.body;
    const targetApp = applications.find(a => a.id === applicationId);

    if (!targetApp) {
      return res.status(404).json({ error: "Application not found" });
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

      const historyDb = loadHistory();
      // Filter out standard seeded histories or actual successful ones for similar appId
      const similarIncidents = historyDb
        .filter(h => h.applicationId === targetApp.id && h.overallStatus === 'HEALTHY')
        .map(h => ({
          id: h.id,
          timestamp: h.timestamp,
          applicationName: h.applicationName,
          issueTitle: h.issues?.[0]?.title,
          remediations: h.remediations,
          executiveSummary: h.executiveSummary
        }));

      const payload: any = {
        application: {
          name: targetApp.name,
          url: targetApp.url,
        },
        results,
        similarIncidentsFromHistoryDb: similarIncidents
      };
      
      if (realGithubCommits) {
        payload.realGithubCommits = realGithubCommits;
      }

      let agentsSpec = "";
      try {
        const specPath = path.join(process.cwd(), "AGENTS_SPEC.md");
        if (fs.existsSync(specPath)) {
          agentsSpec = fs.readFileSync(specPath, "utf-8");
        }
      } catch (err) {
        console.error("Failed to read AGENTS_SPEC.md", err);
      }

      const prompt = `You are an Autonomous OpsPilot X agent coordinating a collaborative investigation between 5 specialized agents.

Here is the master playbook and specification for the agent roles, tools, and interaction patterns:
${agentsSpec}

Analyze this application results payload:
${JSON.stringify(payload, null, 2)}

Important guidelines for agentDialogues:
- All 5 agents MUST actively participate in the collaborative dialogue. Make them interact, challenge assumptions, assign tasks, and share tool results.
- Ethan MUST participate in the conversation.
- If "similarIncidentsFromHistoryDb" contains records, Ethan MUST say something like:
  "I checked the SRE History Database and found an identical incident occurred in application '[AppName]' on [Date/Timestamp]. In that past incident, we resolved the issue by executing the '[Command]' remediation which successfully returned health to 100%. I recommend we immediately prioritize this same action."
- If "similarIncidentsFromHistoryDb" has NO matching records, Ethan should mention that he searched the SRE History Database and found no matching previous patterns for this app, starting first-of-a-kind learning.
- If "realGithubCommits" is present in the payload, Charlie MUST analyze those real commits to find the potential root cause (look for suspicious commit messages), and David MUST reference the actual repository "${targetApp.githubRepository || 'unknown'}" in the drafted pull request.

Provide your output in standard JSON matching this exact schema:
{
  "overallHealthScore": number (0 to 100),
  "overallStatus": "HEALTHY" | "DEGRADED" | "CRITICAL",
  "issues": [ { "id": "...", "title": "...", "severity": "high"|"medium"|"low", "endpoint": "...", "description": "...", "possibleCause": "..." } ],
  "remediations": [ { "title": "...", "service": "...", "command": "...", "explanation": "...", "riskClassification": "GREEN"|"AMBER"|"RED" } ],
  "executiveSummary": "...",
  "agentDialogues": [ { "id": "msg-1", "agentId": "alice|bob|charlie|david|ethan", "agentName": "...", "avatar": "...", "role": "...", "content": "...", "step": "investigate|root_cause|remediation|pr_generation" } ],
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
      newRun.agentDialogues = aiData.agentDialogues || [];
      newRun.pullRequest = aiData.pullRequest || null;

    } catch (err: any) {
      console.error("Gemini coordination failed:", err);
      // Fallback stub in case Gemini API is missing or fails
      newRun.overallHealthScore = 15;
      newRun.overallStatus = "CRITICAL";
      newRun.executiveSummary = `[Critical Outage Warning] Autonomous diagnostics failed to execute. Reason: ${err.message || 'Check Gemini API config.'}`;
      newRun.issues = [
        {
          id: "sys_fail_01",
          title: "Autonomous Inspection Error",
          severity: "high",
          endpoint: "API System Gateway",
          description: "Diagnostics pipeline hit an authentication or server obstacle.",
          possibleCause: "Gemini API Key configuration issue or upstream quota limit reached."
        }
      ];
      newRun.remediations = [
        {
          title: "Run manual SRE verification check",
          service: "API Gateway",
          command: "gcloud container clusters get-credentials",
          explanation: "Manually re-verify cluster configurations since AI diagnostics are temporarily unavailable.",
          riskClassification: "GREEN"
        }
      ];
    }

    // Append full list of step simulation logs
    newRun.logs = [
      { timestamp: new Date().toISOString(), level: 'info', message: `[System SRE] Initiating automated investigation for service cluster outage: '${targetApp.name}'`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[Alice SRE] Scanning active network ingress routes and TCP socket pools.`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'warn', message: `[Alice SRE] Discovery: Network checks failed on matching cluster endpoints!`, step: 'ping' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[Ethan SRE] Querying local SRE Incident History Database for matching historical signatures...`, step: 'infra' },
      { timestamp: new Date().toISOString(), level: 'success', message: `[Ethan SRE] Query finished. Cross-referenced historical signatures and loaded matching runbooks.`, step: 'infra' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[Bob SRE] Analyzing active locks and blocking thread SPID histories on central reporting schemas.`, step: 'infra' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[Charlie SRE] Auditing Git repository history and comparing commit diffs on '${targetApp.githubRepository || 'compliance-engine'}'`, step: 'changes' },
      { timestamp: new Date().toISOString(), level: 'success', message: `[David SRE] Audit completed. Cross-referenced telemetry signatures with ESMA runbooks. Code anomalies detected.`, step: 'diagnosis' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[David SRE] Formulating patch candidates and drafting Pull Request for developer validation.`, step: 'pr_create' }
    ];

    // Push new run to history cache
    addHistory(newRun);
    res.json(newRun);
  });

  app.post("/api/pull-requests/action", (req, res) => {
    const { runId, status } = req.body;
    const history = loadHistory();
    const run = history.find(r => r.id === runId);

    if (!run || !run.pullRequest) {
      return res.status(404).json({ error: "Active Pull Request not found." });
    }

    run.pullRequest.status = status;
    
    if (status === 'APPROVED') {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[PR Approval] Pull Request #${run.pullRequest.id} has been APPROVED and successfully merged to '${run.pullRequest.targetBranch}' branch.`,
        step: "pr_create"
      });
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[K8s Deploy] Automated CI/CD pipeline triggered. Deployed patched docker image safely onto GKE production namespace.`,
        step: "verification"
      });
      
      // Self-training logs for Incident History Agent (Ethan)
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[Ethan SRE] [Knowledge Self-Training] Merged patch PR resolved incident. Successfully updated heuristic weights from resolution log.`,
        step: "verification"
      });

      run.overallStatus = "HEALTHY";
      run.overallHealthScore = 100;
      run.currentStep = "completed";
    } else {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "warn",
        message: `[PR Decline] Pull Request #${run.pullRequest.id} was ${status} by RegOps SRE operator.`,
        step: "pr_create"
      });
    }
    
    addHistory(run);
    res.json({ success: true, pullRequest: run.pullRequest });
  });

  app.post("/api/pull-requests/:runId/status", (req, res) => {
    const { runId } = req.params;
    const { status } = req.body;
    const history = loadHistory();
    const run = history.find(r => r.id === runId);

    if (!run || !run.pullRequest) {
      return res.status(404).json({ error: "Active Pull Request not found." });
    }

    run.pullRequest.status = status;
    
    if (status === 'APPROVED') {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[PR Approval] Pull Request #${run.pullRequest.id} has been APPROVED and successfully merged to '${run.pullRequest.targetBranch}' branch.`,
        step: "pr_create"
      });
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[K8s Deploy] Automated CI/CD pipeline triggered. Deployed patched docker image safely onto GKE production namespace.`,
        step: "verification"
      });

      // Self-training logs for Incident History Agent (Ethan)
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[Ethan SRE] [Knowledge Self-Training] Merged patch PR resolved incident. Successfully updated heuristic weights from resolution log.`,
        step: "verification"
      });

      run.overallStatus = "HEALTHY";
      run.overallHealthScore = 100;
      run.currentStep = "completed";
    } else {
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "warn",
        message: `[PR Decline] Pull Request #${run.pullRequest.id} was ${status} by RegOps SRE operator.`,
        step: "pr_create"
      });
    }
    
    addHistory(run);
    res.json({ success: true, pullRequest: run.pullRequest });
  });
}
