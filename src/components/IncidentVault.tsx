import React from 'react';
import { Activity, ArrowRight, Trash2 } from 'lucide-react';
import { SanityCheckRun, ApplicationProfile } from '../types';

interface IncidentVaultProps {
  history: SanityCheckRun[];
  applications: ApplicationProfile[];
  setSelectedApp: (app: ApplicationProfile) => void;
  setActiveRun: (run: SanityCheckRun) => void;
  setActiveTab: (tab: 'alerts' | 'investigation' | 'history' | 'mcp') => void;
  handleDeleteHistory: (id: string, e: React.MouseEvent) => void;
}

export default function IncidentVault({
  history,
  applications,
  setSelectedApp,
  setActiveRun,
  setActiveTab,
  handleDeleteHistory
}: IncidentVaultProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md text-left animate-fade-in">
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
                  className="p-1.5 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
