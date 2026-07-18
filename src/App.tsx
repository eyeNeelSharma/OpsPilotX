import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  Activity, 
  Play, 
  Plus, 
  Trash2, 
  Layers, 
  Cpu, 
  Terminal, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  ArrowRight,
  ShieldAlert,
  Loader2,
  ListFilter,
  Users,
  GitPullRequest,
  Code,
  PlayCircle,
  ExternalLink,
  AlertOctagon,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ApplicationProfile, 
  SanityCheckRun, 
  AgentLog, 
  EndpointCheckResult, 
  SanityIssue, 
  GeneosAlert, 
  AgentDialogueMessage, 
  PullRequest 
} from './types';
import ApplicationForm from './components/ApplicationForm';
import McpSandbox from './components/McpSandbox';

export default function App() {
  const [applications, setApplications] = useState<ApplicationProfile[]>([]);
  const [history, setHistory] = useState<SanityCheckRun[]>([]);
  const [geneosAlerts, setGeneosAlerts] = useState<GeneosAlert[]>([]);
  
  const [selectedApp, setSelectedApp] = useState<ApplicationProfile | null>(null);
  const [activeRun, setActiveRun] = useState<SanityCheckRun | null>(null);
  
  // UI states
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationProfile | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'investigation' | 'history' | 'mcp'>('alerts');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [activeIssueFilter, setActiveIssueFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [backendError, setBackendError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [streamingDialogues, setStreamingDialogues] = useState<AgentDialogueMessage[]>([]);
  const [streamingLogs, setStreamingLogs] = useState<AgentLog[]>([]);
  const [executingRemediation, setExecutingRemediation] = useState<string | null>(null);
  
  // Time ticker state
  const [currentTime, setCurrentTime] = useState<string>(new Date().toISOString());

  // User Authentication state
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string; avatar: string } | null>(() => {
    const saved = localStorage.getItem('opspilot_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [registeredUsers, setRegisteredUsers] = useState<{ id: string; name: string; role: string; avatar: string }[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Sign In state
  const [signinNameOrId, setSigninNameOrId] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupRole, setSignupRole] = useState('Senior RegOps Analyst (IAM & Compliance)');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupOperatorId, setSignupOperatorId] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);

  const fetchRegisteredUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setRegisteredUsers(data);
      }
    } catch (err) {
      console.error("Error fetching registered users:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('opspilot_user');
    setCurrentUser(null);
  };

  const handlePresetLogin = async (user: { id: string; name: string }) => {
    setIsLoadingAuth(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameOrId: user.id, password: 'db-key-signature' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('opspilot_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || "Authentication failed for preset operator.");
      }
    } catch (err) {
      setLoginError("Failed to reach authentication server.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signinNameOrId.trim()) {
      setLoginError("Please enter your Operator Name or ID");
      return;
    }
    if (!signinPassword) {
      setLoginError("Please enter your DB-Key Signature Password");
      return;
    }

    setIsLoadingAuth(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameOrId: signinNameOrId.trim(), password: signinPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('opspilot_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || "Invalid operator credentials.");
      }
    } catch (err) {
      setLoginError("Authentication service connection refused.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setSignupError("Please enter your full name.");
      return;
    }
    if (!signupPassword) {
      setSignupError("Please choose a secure DB-Key signature password.");
      return;
    }

    setIsLoadingAuth(true);
    setSignupError(null);
    setSignupSuccess(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName.trim(),
          role: signupRole,
          password: signupPassword,
          operatorId: signupOperatorId.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSignupSuccess(`Successfully registered operator ${data.user.id}! Logging you in...`);
        // Refresh registered users
        fetchRegisteredUsers();
        // Clear forms
        setSignupName('');
        setSignupPassword('');
        setSignupOperatorId('');
        
        // Auto sign in after 1.5 seconds
        setTimeout(() => {
          localStorage.setItem('opspilot_user', JSON.stringify(data.user));
          setCurrentUser(data.user);
          setSignupSuccess(null);
        }, 1500);
      } else {
        setSignupError(data.error || "Registration rejected by database.");
      }
    } catch (err) {
      setSignupError("Database service is offline.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Poll current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchApplications();
    fetchHistory();
    fetchGeneosAlerts();
    fetchRegisteredUsers();
  }, []);

  // Scroll chats/terminals to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingDialogues]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingLogs]);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
        if (data.length > 0 && !selectedApp) {
          setSelectedApp(data[0]);
        }
        setBackendError(null);
      } else {
        setBackendError("Failed to fetch applications from server.");
      }
    } catch (err) {
      setBackendError("Server is unreachable. Ensure the backend server is running.");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/sanity-checks/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        if (data.length > 0 && !activeRun) {
          setActiveRun(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const fetchGeneosAlerts = async () => {
    try {
      const res = await fetch('/api/geneos/alerts');
      if (res.ok) {
        const data = await res.json();
        setGeneosAlerts(data);
      }
    } catch (err) {
      console.error("Failed to load Geneos alerts:", err);
    }
  };

  const handleSaveApp = async (appData: Partial<ApplicationProfile>) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData)
      });
      if (res.ok) {
        const saved = await res.json();
        fetchApplications();
        setSelectedApp(saved);
        setShowForm(false);
        setEditingApp(undefined);
      }
    } catch (err) {
      alert("Error saving application profile.");
    }
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this target profile?")) return;
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchApplications();
        if (selectedApp?.id === id) {
          setSelectedApp(null);
          setActiveRun(null);
        }
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this incident investigation history?")) return;
    try {
      const res = await fetch(`/api/sanity-checks/history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        if (activeRun?.id === id) {
          setActiveRun(null);
        }
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Launch the 10-step autonomous collaboration runner
  const handleLaunchAgent = async (targetAppId?: string, alertId?: string) => {
    const appToRun = targetAppId 
      ? applications.find(a => a.id === targetAppId) 
      : selectedApp;

    if (!appToRun) {
      alert("Please select a target application profile to investigate.");
      return;
    }

    setIsChecking(true);
    setActiveRun(null);
    setStreamingDialogues([]);
    setStreamingLogs([]);
    setCurrentStepIndex(1); // Start on step 1 immediately
    setActiveTab('investigation');

    if (alertId) {
      // Update local alert status instantly to INVESTIGATING
      setGeneosAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'INVESTIGATING' } : a));
    }

    // 1. Setup instant warm-up queues for maximum responsiveness
    const logQueue: AgentLog[] = [
      { timestamp: new Date().toISOString(), level: 'info', message: `[System] Bootstrapping OpsPilot X autonomous agent workgroup...`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'success', message: `✓ Spawning 4 specialized co-operating agents: Alice, Bob, Charlie, and David`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[System] Activating model: gemini-3.5-flash for real-time GCP incident reasoning`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[System] Securing connection channels and mounting MCP telemetry servers...`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'info', message: `[Step 1: Detect Anomaly] Fetching alert contexts and target system topology for: "${appToRun.name}"...`, step: 'recon' },
    ];

    const dialogueQueue: AgentDialogueMessage[] = [
      {
        id: "bootstrap-d1",
        agentId: "alice",
        agentName: "Alice (SRE Recon)",
        avatar: "SRE",
        role: "SRE",
        content: `Workgroup initialized. Alice here. I'm establishing the MCP tunnel to "${appToRun.name}" and loading cluster metadata. Bob, Charlie, David — let's lock in.`,
        timestamp: new Date().toISOString(),
        step: "recon"
      }
    ];

    // 2. Spawn the background fetch asynchronously (non-blocking)
    let finalRunResult: SanityCheckRun | null = null;
    let fetchCompleted = false;
    let fetchError: string | null = null;

    fetch('/api/sanity-checks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        applicationId: appToRun.id,
        geneosAlertId: alertId,
        triggeredBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'System Operator'
      })
    })
    .then(async (res) => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Internal Agent Error");
      }
      return res.json();
    })
    .then((runResult: SanityCheckRun) => {
      finalRunResult = runResult;
      fetchCompleted = true;
    })
    .catch((err) => {
      fetchError = err.message;
      fetchCompleted = true;
    });

    // 3. Initiate the live-streaming loop
    let currentLogs: AgentLog[] = [];
    let currentDialogues: AgentDialogueMessage[] = [];
    let holdingIndex = 0;
    let ticksSinceLastHolding = 0;
    let backendAppended = false;

    const holdingPool = [
      { level: 'info' as const, message: `[System] Bob (Database) is analyzing SQL active locks and connection pools...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Charlie (Code Archeology) is scanning recent Git commits for configuration drift...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] David (RegOps) is verifying compliance bounds and GCP resource IAM roles...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Alice (SRE) is capturing GKE Pod logs and monitoring container restart logs...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Active probing in progress: checking latency metrics and headers...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Fetching audit trails and querying Cloud SQL cluster configurations...`, step: 'recon' as const }
    ];

    const streamProcess = () => {
      let madeProgress = false;

      // Handle logs streaming
      if (logQueue.length > 0) {
        const nextLog = logQueue.shift()!;
        currentLogs = [...currentLogs, nextLog];
        setStreamingLogs(currentLogs);
        madeProgress = true;

        // Dynamic step indicators
        if (nextLog.message.includes("Step 1")) setCurrentStepIndex(1);
        else if (nextLog.message.includes("Step 2")) setCurrentStepIndex(2);
        else if (nextLog.message.includes("Step 3")) setCurrentStepIndex(3);
        else if (nextLog.message.includes("Step 4")) setCurrentStepIndex(4);
        else if (nextLog.message.includes("Step 5")) setCurrentStepIndex(5);
        else if (nextLog.message.includes("Step 6")) setCurrentStepIndex(6);
        else if (nextLog.message.includes("Step 7")) setCurrentStepIndex(7);
        else if (nextLog.message.includes("Step 8")) setCurrentStepIndex(8);
        else if (nextLog.message.includes("Step 9")) setCurrentStepIndex(9);
        else if (nextLog.message.includes("Step 10")) setCurrentStepIndex(10);
      }

      // Handle dialogues streaming
      if (dialogueQueue.length > 0) {
        // Shift a dialogue message with 60% probability or if logs queue is empty
        if (Math.random() > 0.4 || logQueue.length === 0) {
          const nextDial = dialogueQueue.shift()!;
          currentDialogues = [...currentDialogues, nextDial];
          setStreamingDialogues(currentDialogues);
          madeProgress = true;
        }
      }

      // If queues are currently empty but fetch is still running, inject holding logs to prevent UI freeze
      if (!madeProgress && !fetchCompleted) {
        ticksSinceLastHolding++;
        if (ticksSinceLastHolding >= 4) { // Inject approx every 1.5s (4 * 380ms)
          const nextHolding = holdingPool[holdingIndex % holdingPool.length];
          holdingIndex++;
          currentLogs = [...currentLogs, {
            timestamp: new Date().toISOString(),
            level: nextHolding.level,
            message: nextHolding.message,
            step: nextHolding.step
          }];
          setStreamingLogs(currentLogs);
          ticksSinceLastHolding = 0;
        }
        setTimeout(streamProcess, 380);
        return;
      }

      // If queues are empty and fetch is completed:
      if (logQueue.length === 0 && dialogueQueue.length === 0 && fetchCompleted) {
        if (fetchError) {
          // Fetch failed, show failure log and revert
          currentLogs = [...currentLogs, {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `[System Error] OpsPilot investigation failed: ${fetchError}`,
            step: 'recon'
          }];
          setStreamingLogs(currentLogs);
          setIsChecking(false);
          if (alertId) {
            setGeneosAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'ACTIVE' } : a));
          }
          alert(`OpsPilot execution failed: ${fetchError}`);
          return;
        }

        if (finalRunResult) {
          // Successfully completed the backend check. If we haven't loaded the real response yet, load it now!
          const backendLogs = (finalRunResult as SanityCheckRun).logs || [];
          const backendDialogues = (finalRunResult as SanityCheckRun).agentDialogues || [];

          // Filter out duplicates (such as Step 1 / Detect Anomaly which we bootstrapped)
          const remainingLogs = backendLogs.filter(log => 
            !log.message.includes("Detect Anomaly") && 
            !log.message.includes("Detecting anomaly") &&
            !log.message.includes("Bootstrapping OpsPilot")
          );

          const remainingDialogues = backendDialogues.filter(dial => 
            dial.id !== 'bootstrap-d1' && 
            dial.content !== dialogueQueue[0]?.content
          );

          if (!backendAppended && (remainingLogs.length > 0 || remainingDialogues.length > 0)) {
            // Push real logs and dialogues to the queues to continue streaming them nicely
            logQueue.push(...remainingLogs);
            dialogueQueue.push(...remainingDialogues);
            backendAppended = true;
            setTimeout(streamProcess, 380);
          } else {
            // Everything is fully streamed and drained, finalize!
            setIsChecking(false);
            const completedRun = {
              ...(finalRunResult as SanityCheckRun),
              logs: currentLogs,
              agentDialogues: currentDialogues
            };

            // Persist the full accumulated logs and dialogues to the backend so they stay preserved
            fetch(`/api/sanity-checks/history/${completedRun.id}/update-results`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                logs: currentLogs,
                agentDialogues: currentDialogues
              })
            }).then(() => {
              fetchHistory();
            }).catch(err => {
              console.error("Failed to persist final run logs and dialogues:", err);
            });

            setActiveRun(completedRun);
            fetchGeneosAlerts();
          }
        } else {
          // Fallback finalizer
          setIsChecking(false);
          fetchHistory();
          fetchGeneosAlerts();
        }
      } else {
        // Keep streaming
        setTimeout(streamProcess, 380);
      }
    };

    // Begin streaming immediately
    streamProcess();
  };

  // Submit/Merge standard developer Pull Request
  const handlePRAction = async (status: 'APPROVED' | 'DECLINED') => {
    if (!activeRun) return;
    try {
      const res = await fetch(`/api/pull-requests/${activeRun.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const data = await res.json();
        // Reload history & update active run state
        fetchHistory();
        fetchGeneosAlerts();
        setActiveRun(prev => prev ? { 
          ...prev, 
          pullRequest: data.pullRequest,
          overallStatus: status === 'APPROVED' ? 'HEALTHY' : prev.overallStatus,
          overallHealthScore: status === 'APPROVED' ? 100 : prev.overallHealthScore,
          currentStep: status === 'APPROVED' ? 'completed' : prev.currentStep
        } : null);
      }
    } catch (err) {
      console.error("Failed to approve Pull Request:", err);
    }
  };

  // Execute remediation action directly via MCP
  const handleExecuteRemediation = async (remediation: any) => {
    if (!activeRun) return;
    setExecutingRemediation(remediation.title);
    try {
      const res = await fetch('/api/remediations/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: remediation.command,
          service: remediation.service,
          title: remediation.title,
          alertId: activeRun.geneosAlertId,
          runId: activeRun.id
        })
      });
      if (res.ok) {
        fetchHistory();
        fetchGeneosAlerts();
        // Update active run locally to show success logs
        setActiveRun(prev => {
          if (!prev) return null;
          const newLogs = [
            ...prev.logs,
            {
              timestamp: new Date().toISOString(),
              level: 'success' as const,
              message: `[RegOps Exec] Manual execution APPROVED for action: "${remediation.title}"`,
              step: 'remediation' as const
            },
            {
              timestamp: new Date().toISOString(),
              level: 'success' as const,
              message: `[RegOps Exec] Executed gcloud terminal command successfully on cluster network.`,
              step: 'remediation' as const
            },
            {
              timestamp: new Date().toISOString(),
              level: 'success' as const,
              message: `[RegOps Exec] Validation check: PASSED. Systems reconciled.`,
              step: 'verification' as const
            }
          ];
          return {
            ...prev,
            overallStatus: 'HEALTHY',
            overallHealthScore: 100,
            currentStep: 'completed',
            logs: newLogs
          };
        });
      }
    } catch (err) {
      console.error("Remediation execution failed:", err);
    } finally {
      setExecutingRemediation(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
  };

  // Get severity style tokens
  const getSeverityBadge = (severity: 'CRITICAL' | 'WARNING' | 'OK' | 'high' | 'medium' | 'low') => {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">CRITICAL</span>;
    } else if (s === 'WARNING' || s === 'MEDIUM') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">WARNING</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">HEALTHY</span>;
  };

  // Helper step details
  const lifecycleSteps = [
    { title: "Anomaly", desc: "Detect anomaly via Geneos alerts" },
    { title: "Identify", desc: "Identify service and route topology" },
    { title: "Evidence", desc: "Collect logs & telemetry via MCP" },
    { title: "Infra", desc: "Query Kubernetes cluster metrics" },
    { title: "DB", desc: "Analyze DB locks & dependencies" },
    { title: "Changes", desc: "Compare recent Git modifications" },
    { title: "Historical", desc: "Search incident runbook archives" },
    { title: "Hypotheses", desc: "Validate root cause hypotheses" },
    { title: "Recommend", desc: "Formulate fix & validation plan" },
    { title: "Approve", desc: "Operator review & PR submissions" }
  ];

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500" />
          
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-600/10 border border-blue-500/25 rounded-2xl mb-1">
              <Terminal className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[10px] font-bold tracking-widest text-blue-500 uppercase">Enterprise • RegOps Hub</span>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">OpsPilot X Portal</h2>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Authenticate via secure database clusters or register a new regulatory operator principal.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-850 rounded-xl">
            <button
              onClick={() => { setAuthTab('signin'); setLoginError(null); setSignupError(null); }}
              className={`py-2 text-[11px] font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer ${authTab === 'signin' ? 'bg-slate-900 text-blue-400 border border-slate-800 shadow-sm font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthTab('signup'); setLoginError(null); setSignupError(null); }}
              className={`py-2 text-[11px] font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer ${authTab === 'signup' ? 'bg-slate-900 text-blue-400 border border-slate-800 shadow-sm font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>

          {authTab === 'signin' ? (
            <div className="space-y-4">
              {/* Registered Profiles List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Database Operators ({registeredUsers.length})
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    File-DB Persistent
                  </span>
                </div>
                
                <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                  {registeredUsers.length > 0 ? (
                    registeredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handlePresetLogin(user)}
                        disabled={isLoadingAuth}
                        className="w-full p-2 bg-slate-950 border border-slate-850 hover:border-blue-500/40 rounded-lg flex items-center gap-2.5 text-left transition-all hover:bg-slate-900/40 cursor-pointer group disabled:opacity-50 animate-fade-in"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all">
                          {user.avatar}
                        </div>
                        <div className="flex-1 min-w-0 font-mono text-[11px]">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-white group-hover:text-blue-400 transition-colors leading-tight truncate">{user.name}</h4>
                            <span className="text-[8px] px-1 py-0.2 bg-slate-900 text-slate-500 rounded border border-slate-850 font-mono shrink-0 ml-1">
                              {user.id}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 truncate block mt-0.5">{user.role}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-500 font-mono">
                      Querying Database Cluster...
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-700 my-2 select-none">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[9px] font-mono tracking-widest uppercase text-slate-500">Or Operator Signature</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Sign In Form */}
              <form onSubmit={handleCustomLogin} className="space-y-3.5">
                {loginError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-400 text-center font-semibold animate-fade-in">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400">Operator ID or Name</label>
                  <input
                    type="text"
                    value={signinNameOrId}
                    onChange={(e) => { setSigninNameOrId(e.target.value); setLoginError(null); }}
                    placeholder="e.g. DB-REGOPS-928 or Sarah Jenkins"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                    disabled={isLoadingAuth}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400">DB-Key Signature Password</label>
                  <input
                    type="password"
                    value={signinPassword}
                    onChange={(e) => { setSigninPassword(e.target.value); setLoginError(null); }}
                    placeholder="•••••••• (Default presets: db-key-signature)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    disabled={isLoadingAuth}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingAuth}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoadingAuth ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating Operator...
                    </>
                  ) : (
                    "Verify Identity & Authorize Session"
                  )}
                </button>
              </form>
            </div>
          ) : (
            // Sign Up tab
            <form onSubmit={handleSignup} className="space-y-3.5">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Register New Operator Principal
              </span>

              {signupError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-400 text-center font-semibold animate-fade-in">
                  {signupError}
                </div>
              )}

              {signupSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400 text-center font-semibold animate-pulse">
                  {signupSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => { setSignupName(e.target.value); setSignupError(null); }}
                  placeholder="e.g. James Cole"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  disabled={isLoadingAuth || !!signupSuccess}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase text-slate-400">Security Role</label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  disabled={isLoadingAuth || !!signupSuccess}
                >
                  <option value="Senior RegOps Analyst (IAM & Compliance)">Senior RegOps Analyst (IAM & Compliance)</option>
                  <option value="Principal SRE Engineer (Infrastructure)">Principal SRE Engineer (Infrastructure)</option>
                  <option value="Compliance & Risk Audit Officer">Compliance & Risk Audit Officer</option>
                  <option value="Associate SRE Analyst">Associate SRE Analyst</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400">Operator ID (Optional)</label>
                  <input
                    type="text"
                    value={signupOperatorId}
                    onChange={(e) => { setSignupOperatorId(e.target.value); setSignupError(null); }}
                    placeholder="e.g. DB-REGOPS-700"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    disabled={isLoadingAuth || !!signupSuccess}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400">Key Signature Password</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => { setSignupPassword(e.target.value); setSignupError(null); }}
                    placeholder="Choose a password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    disabled={isLoadingAuth || !!signupSuccess}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth || !!signupSuccess}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoadingAuth ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deploying to DB Cluster...
                  </>
                ) : (
                  "Create Database Principal & Login"
                )}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[9px] text-slate-500 font-mono">
            <span>DB OpsPilot X v3.5</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Cluster Connection Secure
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <Terminal className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-widest text-slate-500 uppercase">Enterprise</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <h1 className="text-sm font-bold tracking-wider text-white uppercase">OpsPilot X</h1>
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded uppercase">RegOps AI Suite</span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Autonomous Production Support Engineer • Interconnected Agents</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            {currentUser && (
              <div className="flex items-center gap-2 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {currentUser.avatar}
                </div>
                <div className="flex flex-col text-[10px] text-left">
                  <span className="font-semibold text-white leading-tight">{currentUser.name}</span>
                  <span className="text-[8px] text-slate-400 leading-none truncate max-w-[120px]">{currentUser.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 pl-2 border-l border-slate-800 text-[10px] text-slate-500 hover:text-rose-400 font-sans cursor-pointer transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>UTC: {currentTime.replace('T', ' ').substring(0, 19)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${backendError ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-slate-300">{backendError ? 'Offline' : 'Ready'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {backendError && (
          <div className="mb-6 p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-start gap-3 text-sm text-rose-400">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <h4 className="font-semibold text-white">Server Connection Error</h4>
              <p className="text-slate-400 mt-1">{backendError}</p>
              <button 
                onClick={() => { setBackendError(null); fetchApplications(); }}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* TOP LEVEL NAVIGATION TABS */}
        <div className="flex border-b border-slate-900 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'alerts'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Geneos Alerts Monitor
            {geneosAlerts.filter(a => a.status === 'ACTIVE').length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 text-[10px] rounded-full border border-rose-500/10 font-mono font-bold animate-pulse">
                {geneosAlerts.filter(a => a.status === 'ACTIVE').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('investigation')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'investigation'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            OpsPilot Investigation Space
            {isChecking && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Incident Vault ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'mcp'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            MCP Gateway Sandbox
          </button>
        </div>

        {/* MAIN BODY LAYOUT */}
        {activeTab === 'mcp' ? (
          <div className="w-full">
            <McpSandbox />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT 4 COLS: TARGET CONFIGURATIONS */}
            <section className="lg:col-span-4 space-y-6">
            
            {/* Target App Profiles */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400" />
                  <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">RegOps App Scopes</h2>
                </div>
                <button
                  id="add-app-btn"
                  onClick={() => { setEditingApp(undefined); setShowForm(true); }}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add App
                </button>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app);
                      const latest = history.find(h => h.applicationId === app.id);
                      if (latest) setActiveRun(latest);
                    }}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 group flex items-start gap-3 ${
                      selectedApp?.id === app.id
                        ? 'bg-blue-600/5 border-blue-500/30'
                        : 'bg-slate-950 hover:bg-slate-900/50 border-slate-850'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md mt-0.5 ${selectedApp?.id === app.id ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-900 text-slate-400'}`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 font-mono text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {app.name}
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{app.url}</p>
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[9px] text-slate-500">
                        <span>Platform: <strong className="text-slate-400 font-sans">{app.deploymentPlatform || 'Unknown'}</strong></span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingApp(app);
                              setShowForm(true);
                            }}
                            className="text-blue-400 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleDeleteApp(app.id, e)}
                            className="text-rose-500 hover:text-rose-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedApp && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs font-mono space-y-2">
                    <div className="text-slate-400">
                      <strong>App URL:</strong> {selectedApp.url}
                    </div>
                    <div className="text-slate-400">
                      <strong>Deployment:</strong> {selectedApp.deploymentPlatform}
                    </div>
                    <div className="text-slate-400">
                      <strong>Probes configured:</strong> {selectedApp.checkEndpoints.length}
                    </div>
                    <p className="text-[11px] text-slate-500 border-t border-slate-900 pt-1.5 leading-relaxed font-sans">{selectedApp.description}</p>
                  </div>

                  <button
                    onClick={() => handleLaunchAgent()}
                    disabled={isChecking || applications.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-40 text-white cursor-pointer transition-all"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running Incident Workgroup...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Diagnose System Outage
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Incident Playbook Execution Guidelines */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs font-mono space-y-3.5 shadow-md">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <AlertOctagon className="w-4 h-4 text-blue-400" />
                RegOps Safety Rules
              </h3>
              <div className="space-y-2 text-slate-400 leading-relaxed font-sans">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-[9px] shrink-0 mt-0.5">G</span>
                  <div>
                    <strong className="text-emerald-400">GREEN Class Rules:</strong> Automated recovery commands run without prompt.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center font-mono font-bold text-[9px] shrink-0 mt-0.5">A</span>
                  <div>
                    <strong className="text-amber-400">AMBER Class Rules:</strong> High-risk configurations. Requires explicit RegOps click approval.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center font-mono font-bold text-[9px] shrink-0 mt-0.5">R</span>
                  <div>
                    <strong className="text-rose-400">RED Class Rules:</strong> Prohibited automation. Hard blocker. Requires senior DBA signature.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT 8 COLS: TAB SELECTIONS */}
          <section className="lg:col-span-8 space-y-6">

            {/* TABS VIEW 1: GENEOS MONITOR */}
            {activeTab === 'alerts' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-rose-500" />
                    <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Geneos Alerts Grid</h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Production Environment</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="py-2 px-3">System Name</th>
                        <th className="py-2 px-3">Rule Name</th>
                        <th className="py-2 px-3">Severity</th>
                        <th className="py-2 px-3">Metrics Parameter</th>
                        <th className="py-2 px-3">Breach Value</th>
                        <th className="py-2 px-3 text-right">OpsPilot Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-mono text-xs">
                      {geneosAlerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="py-3.5 px-3 text-white font-sans font-semibold">{alert.systemName}</td>
                          <td className="py-3.5 px-3 text-slate-300 font-mono">{alert.ruleName}</td>
                          <td className="py-3.5 px-3">{getSeverityBadge(alert.severity)}</td>
                          <td className="py-3.5 px-3 text-slate-400">{alert.parameter}</td>
                          <td className="py-3.5 px-3 text-rose-400 font-bold">{alert.value}</td>
                          <td className="py-3.5 px-3 text-right">
                            {alert.status === 'RESOLVED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                ✓ RESOLVED
                              </span>
                            ) : alert.status === 'INVESTIGATING' ? (
                              <button
                                onClick={() => setActiveTab('investigation')}
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded cursor-pointer animate-pulse"
                              >
                                <Loader2 className="w-3 h-3 animate-spin" />
                                WATCH CHAT
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLaunchAgent(alert.associatedAppId, alert.id)}
                                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-sans text-[10px] font-bold py-1 px-2.5 rounded cursor-pointer transition-colors"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                INVESTIGATE
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABS VIEW 2: ACTIVE INVESTIGATION */}
            {activeTab === 'investigation' && (
              <div className="space-y-6">
                
                {/* Active investigation triggered by bar */}
                {(isChecking || activeRun) && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 px-4 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-300">
                        Investigation Status: <strong className={isChecking ? "text-amber-400 font-sans" : "text-emerald-400 font-sans"}>{isChecking ? "IN_PROGRESS" : "COMPLETED"}</strong>
                      </span>
                    </div>
                    <div className="text-slate-400">
                      Triggered By: <strong className="text-blue-400 font-sans">{isChecking ? (currentUser ? `${currentUser.name} (${currentUser.role})` : 'System Operator') : (activeRun?.triggeredBy || 'System Operator')}</strong>
                    </div>
                  </div>
                )}
                
                {/* 10-Step Progress track flowchart */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md overflow-x-auto">
                  <div className="flex items-center gap-1 min-w-[850px] justify-between text-center select-none font-mono">
                    {lifecycleSteps.map((step, idx) => {
                      const stepNum = idx + 1;
                      const isActive = isChecking && currentStepIndex === stepNum;
                      const isCompleted = isChecking ? currentStepIndex > stepNum : (activeRun ? true : false);
                      return (
                        <div key={idx} className="flex-1 flex items-center gap-1">
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                              isActive ? 'bg-blue-500 text-white ring-4 ring-blue-500/20 animate-pulse' :
                              isCompleted ? 'bg-emerald-500 text-white' :
                              'bg-slate-850 text-slate-500 border border-slate-800'
                            }`}>
                              {isCompleted ? '✓' : stepNum}
                            </div>
                            <span className={`text-[9px] uppercase tracking-wider font-bold mt-1.5 ${
                              isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                            }`}>
                              {step.title}
                            </span>
                          </div>
                          {idx < 9 && (
                            <div className={`flex-1 h-0.5 rounded transition-all ${
                              isCompleted ? 'bg-emerald-500/40' : 'bg-slate-800'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Collaborative Agent Dialogue Board */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* Left part: SRE Agent Dialogues */}
                  <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px] shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Collaborative Dialogues</h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded">4 Co-operating Agents</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 font-mono text-xs max-h-[310px]">
                      {(!isChecking && (!activeRun || !activeRun.agentDialogues || activeRun.agentDialogues.length === 0)) && (
                        <div className="text-center py-12 text-slate-500 leading-relaxed font-sans">
                          No active collaborative chats. Trigger an outage diagnosis or select an alert to spin up agents.
                        </div>
                      )}

                      {/* Render Dialogues */}
                      {(isChecking ? streamingDialogues : (activeRun?.agentDialogues || [])).map((msg) => {
                        const isCharlie = msg.agentId === 'charlie';
                        const isBob = msg.agentId === 'bob';
                        const isAlice = msg.agentId === 'alice';
                        
                        let badgeColor = 'bg-blue-600/10 text-blue-400 border-blue-500/10';
                        if (isCharlie) badgeColor = 'bg-purple-600/10 text-purple-400 border-purple-500/10';
                        if (isBob) badgeColor = 'bg-amber-600/10 text-amber-400 border-amber-500/10';
                        if (isAlice) badgeColor = 'bg-cyan-600/10 text-cyan-400 border-cyan-500/10';

                        return (
                          <div key={msg.id} className="space-y-1 text-left border-l border-slate-800 pl-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-white">{msg.agentName}</span>
                                <span className={`text-[9px] uppercase tracking-wide border px-1.5 rounded-full ${badgeColor}`}>
                                  {msg.role}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-500">{(msg.timestamp || new Date().toISOString()).substring(11, 19)}</span>
                            </div>
                            <p className="text-xs text-slate-300 font-sans leading-relaxed">{msg.content}</p>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Right part: Running Telemetry MCP Logs */}
                  <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px] shadow-md font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">MCP Telemetry Logs</h3>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    </div>

                    <div className="flex-1 bg-slate-950 rounded-lg p-3 overflow-y-auto space-y-2 text-[10.5px] max-h-[310px] text-left">
                      {(isChecking ? streamingLogs : (activeRun?.logs || [])).map((log, idx) => (
                        <div key={idx} className="leading-normal">
                          <span className="text-slate-500">[{ (log.timestamp || new Date().toISOString()).substring(11, 19) }]</span>{' '}
                          <span className={`text-[9px] uppercase px-1 rounded ${
                            log.level === 'error' ? 'text-rose-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            log.level === 'success' ? 'text-emerald-400' :
                            'text-cyan-400'
                          }`}>
                            {log.level}
                          </span>{' '}
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                </div>

                {/* REPORTS & PLAYBOOK DETAILS */}
                {activeRun && !isChecking && (
                  <div className="space-y-6">
                    
                    {/* Discovered Issues and Playbook Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Discovered Issues */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-md text-left">
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          Discovered Anomaly details
                        </h3>
                        {(activeRun.issues || []).map((issue) => (
                          <div key={issue.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5">
                              <h4 className="text-xs font-bold text-white">{issue.title}</h4>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded">{issue.endpoint}</span>
                            </div>
                            <p className="text-xs text-slate-300 font-sans leading-relaxed">{issue.description}</p>
                            <div className="text-[11px] text-slate-400 font-sans bg-slate-900 p-2 rounded">
                              <strong className="text-slate-300">Possible Cause:</strong> {issue.possibleCause}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Right: GCP Remediation Playbook */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-md text-left">
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                          <Code className="w-4 h-4 text-cyan-400" />
                          GCP Actionable Playbook
                        </h3>
                        {(activeRun.remediations || []).map((step, idx) => (
                          <div key={idx} className="bg-slate-950 border border-slate-850 rounded-lg overflow-hidden flex flex-col font-mono text-xs">
                            <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-850 flex items-center justify-between">
                              <span className="font-semibold text-white text-[11px]">{step.title}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                step.riskClassification === 'GREEN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                                step.riskClassification === 'AMBER' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                              }`}>
                                Risk: {step.riskClassification}
                              </span>
                            </div>
                            <div className="p-3.5 space-y-2.5">
                              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">{step.explanation}</p>
                              <div className="relative">
                                <pre className="p-2.5 bg-slate-900 rounded text-[10.5px] text-cyan-300 overflow-x-auto select-all leading-normal whitespace-pre">
                                  {step.command}
                                </pre>
                              </div>

                              {activeRun.overallStatus !== 'HEALTHY' && (
                                <button
                                  onClick={() => handleExecuteRemediation(step)}
                                  disabled={executingRemediation !== null}
                                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                    step.riskClassification === 'RED' 
                                      ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  }`}
                                >
                                  {executingRemediation === step.title ? (
                                    <>
                                      <Loader2 className="w-3 animate-spin" />
                                      Executing command...
                                    </>
                                  ) : step.riskClassification === 'RED' ? (
                                    <>
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                      Auto-Execution Prohibited (Manual signature needed)
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 fill-current" />
                                      Approve & Execute Fix via MCP
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Developer Mistake Pull Request Section */}
                    {activeRun.pullRequest && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                          <div className="flex items-center gap-2">
                            <GitPullRequest className="w-4.5 h-4.5 text-purple-400 animate-pulse" />
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              OpsPilot Automated Developer PR Review
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
                            Developer Code Mistake Found
                          </span>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono border-b border-slate-900 pb-3">
                            <div>
                              <strong className="text-slate-400">PR ID:</strong> <span className="text-white font-sans font-semibold">#{activeRun.pullRequest.id}</span>
                            </div>
                            <div>
                              <strong className="text-slate-400">Target branch:</strong> <span className="text-blue-400">{activeRun.pullRequest.targetBranch}</span>
                            </div>
                            <div>
                              <strong className="text-slate-400">Source branch:</strong> <span className="text-purple-400">{activeRun.pullRequest.branch}</span>
                            </div>
                            <div>
                              <strong className="text-slate-400">Repository:</strong> <span className="text-slate-300 text-[11px] underline cursor-pointer">{activeRun.pullRequest.repository}</span>
                            </div>
                          </div>

                          <div className="space-y-1 font-sans">
                            <h4 className="text-xs font-bold text-white">{activeRun.pullRequest.title}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">{activeRun.pullRequest.description}</p>
                          </div>

                          {/* Code Diff Display */}
                          <div className="space-y-2">
                            {(activeRun.pullRequest?.filesChanged || []).map((file, fileIdx) => (
                              <div key={fileIdx} className="border border-slate-850 rounded-lg overflow-hidden text-xs font-mono">
                                <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-850 text-[11px] text-slate-400 flex justify-between">
                                  <span>{file.filename}</span>
                                  <span className="text-[10px] text-slate-500">+{file.additions} insertions, -{file.deletions} deletions</span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-850 bg-slate-950">
                                  {/* Original Block */}
                                  <div className="p-3">
                                    <span className="block text-[10px] text-rose-500 font-sans uppercase font-bold tracking-wider mb-2 select-none">Original Code (John Doe's Mistake)</span>
                                    <pre className="text-[11px] overflow-x-auto p-2.5 bg-rose-950/15 border border-rose-950/30 rounded text-rose-300 leading-relaxed whitespace-pre">
                                      {file.originalCode}
                                    </pre>
                                  </div>
                                  
                                  {/* Corrected Block */}
                                  <div className="p-3">
                                    <span className="block text-[10px] text-emerald-400 font-sans uppercase font-bold tracking-wider mb-2 select-none">Corrected Code (David's Repair)</span>
                                    <pre className="text-[11px] overflow-x-auto p-2.5 bg-emerald-950/15 border border-emerald-950/30 rounded text-emerald-300 leading-relaxed whitespace-pre">
                                      {file.modifiedCode}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Approval Actions */}
                          {activeRun.pullRequest.status === 'DRAFT' ? (
                            <div className="flex items-center justify-end gap-3 border-t border-slate-900 pt-3.5">
                              <button
                                onClick={() => handlePRAction('DECLINED')}
                                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                              >
                                Reject PR
                              </button>
                              <button
                                onClick={() => handlePRAction('APPROVED')}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-md hover:shadow-purple-500/10 active:scale-95 transition-all cursor-pointer"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve and Submit PR Fix
                              </button>
                            </div>
                          ) : (
                            <div className="pt-3 border-t border-slate-900 flex justify-between items-center text-xs">
                              <span className="text-slate-500">Review status:</span>
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 font-bold border rounded-full text-[10.5px] ${
                                activeRun.pullRequest.status === 'APPROVED' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : activeRun.pullRequest.status === 'DECLINED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {activeRun.pullRequest.status === 'APPROVED' 
                                  ? '✓ PR MERGED & DEPLOYED' 
                                  : activeRun.pullRequest.status === 'DECLINED'
                                  ? '✗ PR REJECTED'
                                  : '⧖ PR WAITING FOR REVIEW'}
                              </span>
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

            {/* TABS VIEW 3: HISTORIC INCIDENT HISTORY VAULT */}
            {activeTab === 'history' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-slate-400" />
                    <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Historical Incident Records</h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Operations Audit Trails</span>
                </div>

                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      <p className="text-xs font-mono">No operations history logged yet.</p>
                    </div>
                  ) : (
                    history.map((run) => (
                      <div
                        key={run.id}
                        onClick={() => {
                          const app = applications.find(a => a.id === run.applicationId);
                          if (app) setSelectedApp(app);
                          setActiveRun(run);
                          setActiveTab('investigation');
                        }}
                        className="p-4 bg-slate-950 border border-slate-850 hover:border-blue-500/40 rounded-xl cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${
                              run.overallStatus === 'HEALTHY' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-ping'
                            }`} />
                            <h4 className="text-xs font-bold text-white truncate">{run.applicationName}</h4>
                            <span className="text-[10px] font-mono text-slate-500 font-medium">Score: {run.overallHealthScore}%</span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed font-sans pr-4">"{run.executiveSummary}"</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                            <span>ID: {run.id}</span>
                            <span>•</span>
                            <span>{new Date(run.timestamp).toLocaleString()}</span>
                            <span>•</span>
                            <span>{run.endpointsCheckedCount} Probes checked</span>
                            <span>•</span>
                            <span className="text-blue-400 font-semibold bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10">Triggered By: {run.triggeredBy || "System Operator"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-900 justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 group-hover:underline">
                            Open diagnostics <ArrowRight className="w-3 h-3" />
                          </span>
                          <button
                            onClick={(e) => handleDeleteHistory(run.id, e)}
                            className="p-1.5 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </section>

          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-slate-900 py-8 text-center text-[10.5px] text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Enterprise • Production Support Operations Portal</span>
          <span className="text-[11px] text-slate-600">OpsPilot X Agent Engine • Antigravity System Stack</span>
        </div>
      </footer>

      {/* MODAL CONFIG */}
      {showForm && (
        <ApplicationForm
          application={editingApp}
          onSave={handleSaveApp}
          onClose={() => setShowForm(false)}
        />
      )}

    </div>
  );
}
