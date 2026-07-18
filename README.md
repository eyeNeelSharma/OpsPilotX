# OpsPilot X: Autonomous SRE Agent Workspace

OpsPilot X is a highly polished, full-stack SRE incident response application designed to demonstrate the power of autonomous AI agent workgroups in resolving cloud-native issues. By combining a real-time responsive React/Vite front-end, a high-performance Express backend, and the state-of-the-art `gemini-3.5-flash` model, OpsPilot X automates the detection, diagnosis, and remediation of complex Google Cloud Platform (GCP) service anomalies.

---

## 🏛️ Application Architecture

The application is structured as a full-stack, single-page application (SPA) with a custom Express backend that serves as an API proxy and orchestration engine, and a Vite-compiled React frontend for visual telemetry.

```
                      +------------------------------------------+
                      |               Web Browser                |
                      |    (Vite / React Telemetry Frontend)     |
                      +--------------------+---------------------+
                                           |
                                           | HTTP API Requests
                                           v
                      +--------------------+---------------------+
                      |             Express Server               |
                      |        (Node.js API & Proxy)             |
                      +--+------------------+------------------+-+
                         |                  |                  |
       10-Step Workflow  |                  | MCP Bridge       | Generates Analysis,
       Telemetry Streams |                  | Queries          | Dialogue & PR Diffs
                         v                  v                  v
                  +------+---+      +-------+-------+     +----+---------+
                  |  Mock    |      |  Simulated    |     |  Gemini 3.5  |
                  | Geneos   |      |  GCP & MCP    |     |  Flash API   |
                  | Alerts   |      |  Resources    |     |  Integration |
                  +----------+      +---------------+     +--------------+
```

### 1. Telemetry Frontend (Vite + React)
- **Fluid Layout**: Visualized with a tailored, high-contrast Slate Theme using modern CSS styling (Tailwind CSS v4) and typography.
- **Micro-Animations**: Framed using `motion` from `motion/react` to provide smooth, natural transitions between different tabs, logs, and dialogue feeds.
- **Paced Event Stream Engine**: Employs an ultra-responsive client-side stream loop that boots immediately during the backend's reasoning stage to keep the user engaged. It dynamically injects holding status logs (e.g., *"Bob is checking Cloud SQL locks..."*) to guarantee an interactive experience.

### 2. Orchestration Backend (Express + Node.js)
- **Dev/Prod Unified Server**: Boots in development using `tsx` and bundles to a single CommonJS file (`dist/server.cjs`) for production.
- **Interactive Probes**: Simulates live API polling checks on target service endpoints (e.g., Auth, DB query performance, asset storage) before invoking the reasoning model.
- **Safety Fallbacks**: Includes a robust fallback simulator that automatically takes over if the Gemini API experiences service limits, preventing application crashes.

---

## 🤖 Collaborative Agent Orchestration

OpsPilot X models a specialized, collaborative, SRE-oriented autonomous agent workgroup. The core orchestration is handled server-side through structured prompt engineering with the Gemini API.

```
         +-------------------------------------------------------------+
         |                       OpsPilot X                            |
         |                 Autonomous Coordinator                      |
         +------+-----------------+-----------------+------------------+
                |                 |                 |
                v                 v                 v
         +------+----+      +-----+----+      +-----+----+       +-----+----+
         |   Alice   |      |   Bob    |      | Charlie  |       |  David   |
         | SRE Recon |      | Database |      | Code Arc |       |  RegOps  |
         +-----------+      +----------+      +----------+       +----------+
```

The team consists of four specialized co-operating agents, each with separate areas of expertise:

1. **Alice (SRE Recon Coordinator)**:
   - **Role**: Infrastructure telemetry and cluster health coordination.
   - **Task**: Inspects server status, extracts GKE pod logs, monitors container configurations, and validates ingress routing.
2. **Bob (Database Specialist)**:
   - **Role**: Database health, query optimization, and storage analytics.
   - **Task**: Examines Cloud SQL instances, counts connection pools, detects active transaction locks, and checks for relational schema drift.
3. **Charlie (Code Archeology Expert)**:
   - **Role**: Code correctness, version control, and system configuration.
   - **Task**: Scans Git commit history, inspects build files, reviews environment variables, and identifies developer-introduced deployment mistakes.
4. **David (RegOps & Compliance Coordinator)**:
   - **Role**: Compliance, risk classification, and auto-remediation.
   - **Task**: Reviews security IAM permissions, classifies risk bounds (**GREEN**, **AMBER**, **RED**), generates safe `gcloud` repair commands, and designs a clean Git Pull Request (PR) to correct the anomaly.

### Orchestration Mechanism
- When an investigation is triggered, the backend compiles all endpoint response payloads, headers, and metadata.
- A highly structured prompt is dispatched to `gemini-3.5-flash`, forcing it to output a rigid JSON schema.
- The model orchestrates a conversational debate where the 4 agents incrementally share evidence, cross-reference telemetry, discover the root cause, and agree on a remediation plan.
- The result includes an executive summary, segmented severity scores, risk-classified SRE steps, and a fully formed unified Git diff ready for developer review.

---

## 🔌 Model Context Protocol (MCP) Integration

The **Model Context Protocol (MCP)** is an open standard that allows LLM applications to securely expose systems, data, and tools to AI agents. In OpsPilot X, MCP is utilized as a secure telemetry and control bridge between the autonomous workgroup and target cloud resources.

### How MCP operates in this environment:
- **Unified Tool Interface**: Instead of the agents having to hardcode API endpoints, they use standardized MCP schemas to interact with external data sources.
- **Secure Telemetry Pull**: 
  - **Alice** queries GKE cluster state and fetches live pod metrics via an MCP Kubernetes server.
  - **Bob** connects to a Cloud SQL MCP server to query database tables, monitor read/write operations, and view system locking states safely.
  - **Charlie** reads recent git repository commits and file systems via an MCP Git server.
- **Controlled Automation Push**:
  - When **David** drafts the Pull Request and recommends the remediation steps, he interacts with an MCP GCP Control plane server.
  - This interface safely isolates command executions, allowing David to propose, validate, and write a branch fix without bypassing organizational boundary policies.

---

## 💻 Running the Application Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **NPM** (v9 or higher)
- **Gemini API Key**: Obtain a key from the [Google AI Studio Console](https://aistudio.google.com/).

### 1. Installation
Extract the package contents, navigate to the root directory, and install dependencies:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory based on `.env.example`:
```env
# Port configuration (Hardcoded to 3000 inside the AI Studio infrastructure)
PORT=3000

# Your secure Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Running in Development Mode
Start the unified full-stack server using `tsx`:
```bash
npm run dev
```
The server will start running at `http://localhost:3000`. Open this URL in your web browser to access the OpsPilot X workspace.

### 4. Compiling and Running in Production Mode
Compile the Vite React frontend assets and package the server TypeScript file into a CJS bundle with `esbuild`:
```bash
# Build the production bundle
npm run build

# Start the compiled production bundle
npm run start
```

---

## ☁️ Google Cloud Platform (GCP) Deployment

OpsPilot X is optimized to run as a serverless container inside Google Cloud Run. Follow these step-by-step instructions to deploy the application onto your GCP project.

### 1. Set Up Your Local GCP Environment
Ensure you have the [Google Cloud SDK](https://cloud.google.com/sdk) installed and authenticated:
```bash
# Log in to your Google Account
gcloud auth login

# Set your active GCP project ID
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required GCP Service APIs
Enable Cloud Build, Cloud Run, and Secret Manager APIs for your project:
```bash
gcloud services enable run.googleapis.com \
                       cloudbuild.googleapis.com \
                       secretmanager.googleapis.com
```

### 3. Store Your Gemini API Key in Secret Manager
To keep your API keys secure and isolated from your application code, store it inside Google Cloud Secret Manager:
```bash
# Create the secret key holder
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# Add your actual API key as the first version
echo -n "your_actual_gemini_api_key" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

### 4. Deploy the Container to Cloud Run
Using Google Cloud Build, you can compile and build your container directly in the cloud and host it onto Cloud Run. This completely bypasses the need for local Docker engines:

```bash
gcloud run deploy ops-pilot-x \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3000 \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### Why these flags are important:
- `--source .`: Instructs GCP to detect the project files and automatically build a optimized Node.js runtime container via Cloud Buildpacks.
- `--port 3000`: Ensures that ingress traffic is routed correctly to the Express backend port.
- `--set-secrets="..."`: Mounts the secure secret from GCP Secret Manager directly into the runtime's `process.env.GEMINI_API_KEY` environment variable without exposing it in the deployment scripts.

Once completed, the command line will print a secure, HTTPS live URL. You can share this URL with your SRE team to begin diagnosing alerts collaboratively!
