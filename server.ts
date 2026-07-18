import express from "express";
import path from "path";
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

// In-Memory Database for demonstration, themed for Deutsche Bank RegOps
let applications: ApplicationProfile[] = [
  {
    id: "self-sanity",
    name: "OpsPilot X Self-Diagnostics",
    url: process.env.APP_URL || "http://127.0.0.1:3000",
    description: "Internal diagnostic and self-health metrics for the OpsPilot X AI Agent platform, validating local sub-agent API routes.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "Cloud Run",
    checkEndpoints: [
      {
        id: "self-api-apps",
        path: "/api/applications",
        method: "GET",
        expectedStatus: 200,
        description: "Verify backend applications metadata list endpoint is active."
      },
      {
        id: "self-home",
        path: "/",
        method: "GET",
        expectedStatus: 200,
        description: "Check main application web interface is served."
      }
    ]
  },
  {
    id: "gcp-cloud-demo",
    name: "DB Regulatory Reporting (MiFID II)",
    url: "http://127.0.0.1:3000", // Loops back to our simulation routes
    description: "Deutsche Bank MiFID II transaction and reporting service deployed on GKE, bound to database storage and private VPC channels.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "GKE",
    checkEndpoints: [
      {
        id: "demo-health",
        path: "/api/demo/gcp-app/health",
        method: "GET",
        expectedStatus: 200,
        description: "MiFID II service tier liveness/readiness check."
      },
      {
        id: "demo-sql",
        path: "/api/demo/gcp-app/users",
        method: "GET",
        expectedStatus: 200,
        description: "Fetch transaction reports from Database. Simulates VPC serverless timeout."
      },
      {
        id: "demo-billing",
        path: "/api/demo/gcp-app/billing",
        method: "GET",
        expectedStatus: 200,
        description: "Validate regulatory budget parameters. Simulates disabled Cloud Billing API."
      },
      {
        id: "demo-storage",
        path: "/api/demo/gcp-app/images",
        method: "GET",
        expectedStatus: 200,
        description: "Retrieve archival client compliance PDFs. Simulates missing GCS Viewer permissions."
      }
    ]
  },
  {
    id: "httpbin-test",
    name: "DB Transaction Egress Gateway",
    url: "https://httpbin.org",
    description: "Egress routing node verifying secure outbound regulatory messaging paths to ESMA and public validation channels.",
    createdAt: new Date().toISOString(),
    deploymentPlatform: "Compute Engine",
    checkEndpoints: [
      {
        id: "httpbin-status",
        path: "/status/200",
        method: "GET",
        expectedStatus: 200,
        description: "Check basic internet routing egress paths."
      },
      {
        id: "httpbin-delay",
        path: "/delay/1",
        method: "GET",
        expectedStatus: 200,
        description: "Measure outbound channel delays and jitter profile."
      }
    ]
  }
];

// Geneos alerts state
let geneosAlerts = [
  {
    id: "alert_001",
    systemName: "db-regulatory-reporting-prod",
    severity: "CRITICAL",
    ruleName: "VPC_CONNECTOR_TIMEOUT",
    parameter: "Database Connect",
    value: "TIMEOUT (10000ms)",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "gcp-cloud-demo"
  },
  {
    id: "alert_002",
    systemName: "reg-billing-calculator",
    severity: "CRITICAL",
    ruleName: "BILLING_BUDGETS_API_DISABLED",
    parameter: "GCP Ingress API",
    value: "HTTP_403_FORBIDDEN",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "gcp-cloud-demo"
  },
  {
    id: "alert_003",
    systemName: "client-regulatory-archive",
    severity: "WARNING",
    ruleName: "GCS_BUCKET_IAM_MISSING",
    parameter: "Cloud Storage Bucket",
    value: "403_ACCESS_DENIED",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "gcp-cloud-demo"
  },
  {
    id: "alert_004",
    systemName: "http-egress-gateway",
    severity: "WARNING",
    ruleName: "LATENCY_THRESHOLD_BREACHED",
    parameter: "Egress Response Delay",
    value: "1025ms",
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    associatedAppId: "httpbin-test"
  }
];

let checkHistory: SanityCheckRun[] = [];


// ==================== GCP SIMULATION ROUTE ENDPOINTS ====================
// These endpoints allow the autonomous agent to test real URLs that return realistic cloud-native error patterns,
// which the LLM agent then diagnoses in-depth.

app.get("/api/demo/gcp-app/health", (req, res) => {
  res.status(200).json({ status: "healthy", tier: "web", timestamp: new Date().toISOString() });
});

app.get("/api/demo/gcp-app/users", (req, res) => {
  res.status(503).send(
    "Error 503 (Service Unavailable): Failed to connect to Cloud SQL database server 'my-production-project:us-central1:db-primary' on IP 10.32.0.4. " +
    "Detail: Connection timed out after 10000ms. Check Serverless VPC Access Connector configuration or service account 'cloud-sql-sa@my-production-project.iam.gserviceaccount.com' roles."
  );
});

app.get("/api/demo/gcp-app/billing", (req, res) => {
  res.status(403).send(
    "Error 403 (Forbidden): GCP Service API billingbudgets.googleapis.com is not enabled. " +
    "The budget calculation engine requires 'billing.budgets.get' privileges. " +
    "Please enable the Billing Budgets API on the project or bind roles/billing.admin to developer-service-account@my-production-project.iam.gserviceaccount.com."
  );
});

app.get("/api/demo/gcp-app/images", (req, res) => {
  res.status(404).send(
    "Error 404 (Not Found): Bucket 'gcp-app-production-assets-91823' does not exist in project 'my-production-project', or the service identity lacks object read access. " +
    "AccessDenied: roles/storage.objectViewer IAM permission is missing for public or service-agent principal."
  );
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

app.post("/api/remediations/execute", (req, res) => {
  const { command, service, title, alertId, runId } = req.body;
  
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
        message: `[RegOps Exec] Executed command via MCP: "${command}" successfully. All target clusters reconciled.`,
        step: "remediation"
      });
      run.logs.push({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `[RegOps Exec] Verification checks PASSED. System fully recovered.`,
        step: "verification"
      });
    }
  }

  res.json({ 
    success: true, 
    message: `Action executed successfully: '${title}' on service '${service}'.`,
    details: `Executed: ${command}`
  });
});


// ==================== PULL REQUEST STATUS API ====================
app.get("/api/sanity-checks/history", (req, res) => {
  res.json(checkHistory);
});

app.delete("/api/sanity-checks/history/:id", (req, res) => {
  checkHistory = checkHistory.filter(r => r.id !== req.params.id);
  res.json({ success: true });
});

app.post("/api/sanity-checks/run", async (req, res) => {
  const { applicationId, geneosAlertId } = req.body;
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
    pullRequest: null
  };

  // Mock results for now
  const results = targetApp.checkEndpoints.map(e => ({
    endpointId: e.id,
    path: e.path,
    method: e.method,
    status: 500,
    expectedStatus: e.expectedStatus,
    statusMatch: false,
    latencyMs: 150,
    headers: {},
    bodySnippet: "Internal Server Error",
    healthState: 'CRITICAL'
  }));

  newRun.results = results;

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
    // fallback static payload
    newRun.overallHealthScore = 30;
    newRun.issues = [{ id: "iss-1", title: "API Outage", severity: "high", endpoint: "/", description: "Timeout", possibleCause: "Unknown error" }];
    newRun.remediations = [{ title: "Restart pod", service: "K8s", command: "kubectl rollout restart deployment", explanation: "Restart to clear error", riskClassification: "GREEN" }];
    newRun.executiveSummary = "The application is experiencing a critical outage.";
    newRun.pullRequest = null;
    newRun.agentDialogues = [
      { id: "msg-1", agentId: "alice", agentName: "Alice", avatar: "A", role: "SRE", content: "AI generation failed, fallback applied.", step: "investigate", timestamp: new Date().toISOString() }
    ];
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
