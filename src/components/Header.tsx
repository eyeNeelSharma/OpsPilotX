import React from 'react';
import { Terminal, Clock } from 'lucide-react';

interface HeaderProps {
  currentUser: { id: string; name: string; role: string; avatar: string } | null;
  handleLogout: () => void;
  currentTime: string;
  backendError: string | null;
}

export default function Header({ currentUser, handleLogout, currentTime, backendError }: HeaderProps) {
  return (
    <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
            <Terminal className="w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-left">
              <span className="font-mono text-xs font-bold tracking-widest text-slate-500 uppercase">Enterprise</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              <h1 className="text-sm font-bold tracking-wider text-white uppercase">OpsPilot X</h1>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded uppercase">RegOps AI Suite</span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 text-left">Autonomous Production Support Engineer • Interconnected Agents</p>
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
  );
}
