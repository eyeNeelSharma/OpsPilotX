import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';

interface AuthSectionProps {
  onAuthSuccess: (user: { id: string; name: string; role: string; avatar: string }) => void;
}

interface UserProfile {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export default function AuthSection({ onAuthSuccess }: AuthSectionProps) {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
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

  useEffect(() => {
    fetchRegisteredUsers();
  }, []);

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

  const handlePresetLogin = async (user: UserProfile) => {
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
        onAuthSuccess(data.user);
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
        onAuthSuccess(data.user);
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
        fetchRegisteredUsers();
        setSignupName('');
        setSignupPassword('');
        setSignupOperatorId('');
        
        setTimeout(() => {
          onAuthSuccess(data.user);
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
            <div className="space-y-2 text-left">
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
            <form onSubmit={handleCustomLogin} className="space-y-3.5 text-left">
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
          /* Sign Up tab */
          <form onSubmit={handleSignup} className="space-y-3.5 text-left">
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
                <option value="Compliance & Risk Audit Officer">Compliance & Risk Officer</option>
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
