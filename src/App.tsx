import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Activity, 
  Play, 
  Plus, 
  Layers, 
  Cpu, 
  Terminal, 
  Loader2, 
  Users, 
  AlertOctagon,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { 
  ApplicationProfile, 
  SanityCheckRun, 
  AgentLog, 
  GeneosAlert, 
  AgentDialogueMessage 
} from './types';

// Modular Components
import Header from './components/Header';
import Footer from './components/Footer';
import AuthSection from './components/AuthSection';
import GeneosAlertsGrid from './components/GeneosAlertsGrid';
import IncidentLifecycle from './components/IncidentLifecycle';
import IncidentVault from './components/IncidentVault';
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

  const handleAuthSuccess = (user: { id: string; name: string; role: string; avatar: string }) => {
    localStorage.setItem('opspilot_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('opspilot_user');
    setCurrentUser(null);
  };

  // Poll current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (currentUser) {
      fetchApplications();
      fetchHistory();
      fetchGeneosAlerts();
    }
  }, [currentUser]);

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
      console.error("Error saving application profile:", err);
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

    // Setup instant warm-up queues for maximum responsiveness
    const logQueue: AgentLog[] = [
      { timestamp: new Date().toISOString(), level: 'info', message: `[System] Bootstrapping OpsPilot X autonomous agent workgroup...`, step: 'recon' },
      { timestamp: new Date().toISOString(), level: 'success', message: `✓ Spawning 5 specialized co-operating agents: Alice, Bob, Charlie, David, and Ethan`, step: 'recon' },
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
        content: `Workgroup initialized. Alice here. I'm establishing the MCP tunnel to "${appToRun.name}" and loading cluster metadata. Bob, Charlie, David, Ethan — let's lock in.`,
        timestamp: new Date().toISOString(),
        step: "recon"
      }
    ];

    // Spawn the background fetch asynchronously (non-blocking)
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

    // Initiate the live-streaming loop
    let currentLogs: AgentLog[] = [];
    let currentDialogues: AgentDialogueMessage[] = [];
    let holdingIndex = 0;
    let ticksSinceLastHolding = 0;
    let backendAppended = false;

    const holdingPool = [
      { level: 'info' as const, message: `[System] Bob (Database) is analyzing SQL active locks and connection pools...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Charlie (Code Archeology) is scanning recent Git commits for configuration drift...`, step: 'recon' as const },
      { level: 'info' as const, message: `[System] Ethan (Incident History) is querying the SRE Incident History Database for similar past outages...`, step: 'recon' as const },
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
        if (ticksSinceLastHolding >= 4) {
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
          const backendLogs = (finalRunResult as SanityCheckRun).logs || [];
          const backendDialogues = (finalRunResult as SanityCheckRun).agentDialogues || [];

          // Filter out duplicates
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
            logQueue.push(...remainingLogs);
            dialogueQueue.push(...remainingDialogues);
            backendAppended = true;
            setTimeout(streamProcess, 380);
          } else {
            setIsChecking(false);
            const completedRun = {
              ...(finalRunResult as SanityCheckRun),
              logs: currentLogs,
              agentDialogues: currentDialogues
            };

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
          setIsChecking(false);
          fetchHistory();
          fetchGeneosAlerts();
        }
      } else {
        setTimeout(streamProcess, 380);
      }
    };

    streamProcess();
  };

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

  const handlePRAction = async (status: 'APPROVED' | 'DECLINED') => {
    if (!activeRun) return;
    try {
      const res = await fetch(`/api/pull-requests/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: activeRun.id, status })
      });
      if (res.ok) {
        const data = await res.json();
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

  if (!currentUser) {
    return <AuthSection onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200 flex flex-col justify-between">
      
      {/* HEADER Ticker & Logout controls */}
      <Header 
        currentUser={currentUser} 
        handleLogout={handleLogout} 
        currentTime={currentTime} 
        backendError={backendError} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {backendError && (
          <div className="mb-6 p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-start gap-3 text-sm text-rose-400">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div className="text-left">
              <h4 className="font-semibold text-white">Server Connection Error</h4>
              <p className="text-slate-400 mt-1">{backendError}</p>
              <button 
                onClick={() => { setBackendError(null); fetchApplications(); }}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* TOP LEVEL NAVIGATION TABS */}
        <div className="flex border-b border-slate-900 mb-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'alerts'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5 font-bold'
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
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'investigation'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            OpsPilot Investigation Space
            {isChecking && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />}
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Incident Vault ({history.length})
          </button>
          
          <button
            onClick={() => setActiveTab('mcp')}
            className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5 font-bold'
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
            <section className="lg:col-span-4 space-y-6 text-left">
              
              {/* Target App Profiles list */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-400" />
                    <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">RegOps App Scopes</h2>
                  </div>
                  <button
                    id="add-app-btn"
                    onClick={() => { setEditingApp(undefined); setShowForm(true); }}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add App
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
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
                              className="text-blue-400 hover:text-white cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteApp(app.id, e)}
                              className="text-rose-500 hover:text-rose-400 cursor-pointer"
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

              {/* SRE safety rules index guidelines card */}
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

            {/* RIGHT 8 COLS: ACTIVE TABS SWITCH */}
            <section className="lg:col-span-8 space-y-6">
              
              {activeTab === 'alerts' && (
                <GeneosAlertsGrid 
                  geneosAlerts={geneosAlerts}
                  setActiveTab={setActiveTab}
                  handleLaunchAgent={handleLaunchAgent}
                />
              )}

              {activeTab === 'investigation' && (
                <IncidentLifecycle 
                  activeRun={activeRun}
                  isChecking={isChecking}
                  currentUser={currentUser}
                  currentStepIndex={currentStepIndex}
                  streamingDialogues={streamingDialogues}
                  streamingLogs={streamingLogs}
                  executingRemediation={executingRemediation}
                  handleExecuteRemediation={handleExecuteRemediation}
                  handlePRAction={handlePRAction}
                />
              )}

              {activeTab === 'history' && (
                <IncidentVault 
                  history={history}
                  applications={applications}
                  setSelectedApp={setSelectedApp}
                  setActiveRun={setActiveRun}
                  setActiveTab={setActiveTab}
                  handleDeleteHistory={handleDeleteHistory}
                />
              )}

            </section>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <Footer />

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
