export interface CheckEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  expectedKeyword?: string;
  description?: string;
}

export interface ApplicationProfile {
  id: string;
  name: string;
  url: string;
  description: string;
  createdAt: string;
  checkEndpoints: CheckEndpoint[];
  deploymentPlatform?: 'Cloud Run' | 'GKE' | 'Compute Engine' | 'App Engine' | 'Cloud Functions' | 'Unknown';
  githubRepository?: string; // Format: owner/repo
  githubToken?: string;      // Optional PAT for accessing real Github API
}

export interface AgentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: 'recon' | 'ping' | 'content' | 'api' | 'diagnosis' | 'remediation' | 'verification' | 'pr_create';
}

export interface EndpointCheckResult {
  endpointId: string;
  path: string;
  method: string;
  status: number;
  expectedStatus: number;
  statusMatch: boolean;
  latencyMs: number;
  keywordMatched?: boolean;
  keywordExpected?: string;
  headers: Record<string, string>;
  bodySnippet: string;
  healthState: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  geminiAnalysis?: string;
}

export interface SanityIssue {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  endpoint: string;
  description: string;
  possibleCause: string;
}

export interface GCPRemediationStep {
  title: string;
  service: string;
  command: string;
  explanation: string;
  riskClassification: 'GREEN' | 'AMBER' | 'RED';
}

// Geneos alert model for Deutsche Bank RegOps monitoring
export interface GeneosAlert {
  id: string;
  systemName: string;
  severity: 'CRITICAL' | 'WARNING' | 'OK';
  ruleName: string;
  parameter: string;
  value: string;
  timestamp: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'REMEDIATING' | 'RESOLVED';
  associatedAppId?: string;
}

// Multi-Agent Collaboration models
export interface CollaborativeAgent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  specialty: string;
}

export interface AgentDialogueMessage {
  id: string;
  agentId: string;
  agentName: string;
  avatar: string;
  role: string;
  content: string;
  timestamp: string;
  step: 'recon' | 'investigate' | 'root_cause' | 'remediation' | 'pr_generation';
}

export interface PullRequestFile {
  filename: string;
  originalCode: string;
  modifiedCode: string;
  additions: number;
  deletions: number;
}

export interface PullRequest {
  id: string;
  title: string;
  description: string;
  repository: string;
  branch: string;
  targetBranch: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'DECLINED';
  filesChanged: PullRequestFile[];
  createdAt: string;
}

export interface SanityCheckRun {
  id: string;
  applicationId: string;
  applicationName: string;
  applicationUrl: string;
  timestamp: string;
  overallHealthScore: number; // 0 to 100
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  latencyAvg: number;
  endpointsCheckedCount: number;
  endpointsPassedCount: number;
  logs: AgentLog[];
  results: EndpointCheckResult[];
  issues: SanityIssue[];
  remediations: GCPRemediationStep[];
  executiveSummary: string;
  
  // Custom OpsPilot X additions
  geneosAlertId?: string;
  currentStep: 'detect' | 'identify' | 'evidence' | 'infra' | 'dependencies' | 'changes' | 'historical' | 'hypothesis' | 'recommend' | 'review' | 'execution' | 'verification' | 'completed';
  agentDialogues: AgentDialogueMessage[];
  pullRequest?: PullRequest;
}

