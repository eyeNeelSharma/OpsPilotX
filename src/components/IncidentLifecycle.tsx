import React, { useEffect, useRef } from 'react';
import { 
  Users, 
  Terminal, 
  AlertTriangle, 
  Code, 
  Loader2, 
  Play, 
  ShieldAlert, 
  GitPullRequest, 
  CheckCircle 
} from 'lucide-react';
import { SanityCheckRun, AgentDialogueMessage, AgentLog } from '../types';

interface IncidentLifecycleProps {
  activeRun: SanityCheckRun | null;
  isChecking: boolean;
  currentUser: { id: string; name: string; role: string; avatar: string } | null;
  currentStepIndex: number;
  streamingDialogues: AgentDialogueMessage[];
  streamingLogs: AgentLog[];
  executingRemediation: string | null;
  handleExecuteRemediation: (remediation: any) => Promise<void>;
  handlePRAction: (status: 'APPROVED' | 'DECLINED') => Promise<void>;
}

const LIFECYCLE_STEPS = [
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

export default function IncidentLifecycle({
  activeRun,
  isChecking,
  currentUser,
  currentStepIndex,
  streamingDialogues,
  streamingLogs,
  executingRemediation,
  handleExecuteRemediation,
  handlePRAction
}: IncidentLifecycleProps) {
  
  const localChatEndRef = useRef<HTMLDivElement>(null);
  const localTerminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chats
  useEffect(() => {
    if (localChatEndRef.current) {
      localChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingDialogues, isChecking, activeRun]);

  // Auto-scroll terminals
  useEffect(() => {
    if (localTerminalEndRef.current) {
      localTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingLogs, isChecking, activeRun]);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      
      {/* Active investigation status bar */}
      {(isChecking || activeRun) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
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
          {LIFECYCLE_STEPS.map((step, idx) => {
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left part: SRE Agent Dialogues */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px] shadow-md">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Collaborative Dialogues</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded">5 Co-operating Agents</span>
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
              const isEthan = msg.agentId === 'ethan';
              
              let badgeColor = 'bg-blue-600/10 text-blue-400 border-blue-500/10';
              if (isCharlie) badgeColor = 'bg-purple-600/10 text-purple-400 border-purple-500/10';
              if (isBob) badgeColor = 'bg-amber-600/10 text-amber-400 border-amber-500/10';
              if (isAlice) badgeColor = 'bg-cyan-600/10 text-cyan-400 border-cyan-500/10';
              if (isEthan) badgeColor = 'bg-emerald-600/10 text-emerald-400 border-emerald-500/10';

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
            <div ref={localChatEndRef} />
          </div>
        </div>

        {/* Right part: Running Telemetry MCP Logs */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px] shadow-md font-mono text-xs">
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
            <div ref={localTerminalEndRef} />
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
  );
}
