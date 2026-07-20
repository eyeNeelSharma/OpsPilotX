import React from 'react';
import { Activity, Loader2, PlayCircle } from 'lucide-react';
import { GeneosAlert } from '../types';

interface GeneosAlertsGridProps {
  geneosAlerts: GeneosAlert[];
  setActiveTab: (tab: 'alerts' | 'investigation' | 'history' | 'mcp') => void;
  handleLaunchAgent: (associatedAppId: string | undefined, alertId: string) => void;
}

export default function GeneosAlertsGrid({ geneosAlerts, setActiveTab, handleLaunchAgent }: GeneosAlertsGridProps) {
  
  const getSeverityBadge = (severity: 'CRITICAL' | 'WARNING' | 'OK' | 'high' | 'medium' | 'low') => {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">CRITICAL</span>;
    } else if (s === 'WARNING' || s === 'MEDIUM') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">WARNING</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">HEALTHY</span>;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md text-left animate-fade-in">
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
  );
}
