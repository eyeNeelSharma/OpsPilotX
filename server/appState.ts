import { ApplicationProfile, SanityCheckRun, GeneosAlert } from "../src/types";

export let applications: ApplicationProfile[] = [
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

export let geneosAlerts: GeneosAlert[] = [
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
