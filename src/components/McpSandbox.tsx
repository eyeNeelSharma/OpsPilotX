import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Cpu, 
  RefreshCw, 
  Play, 
  FileCode, 
  Layers, 
  HelpCircle, 
  Activity, 
  CheckCircle, 
  ArrowRight, 
  Database,
  Lock,
  Network,
  Share2
} from 'lucide-react';

interface McpLog {
  timestamp: string;
  type: string;
  payload: any;
  response: any;
}

export default function McpSandbox() {
  const [logs, setLogs] = useState<McpLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<McpLog | null>(null);

  // Tool Call State
  const [selectedTool, setSelectedTool] = useState<string>('inspect_ibm_mq_queue');
  const [toolParams, setToolParams] = useState<Record<string, any>>({
    queueName: 'MIFID.RATES.IN'
  });
  const [toolResult, setToolResult] = useState<any>(null);
  const [isCallingTool, setIsCallingTool] = useState(false);

  // Resource Read State
  const [selectedResource, setSelectedResource] = useState<string>('mcp://mifid-rates/ibm-mq-logs');
  const [resourceResult, setResourceResult] = useState<any>(null);
  const [isReadingResource, setIsReadingResource] = useState(false);

  // Active DB State
  const [dbState, setDbState] = useState<any>(null);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Available Tools definition
  const mcpTools = [
    {
      name: 'inspect_ibm_mq_queue',
      description: 'Fetch queue depth and socket state for regulated message channels.',
      fields: [{ name: 'queueName', type: 'text', defaultValue: 'MIFID.RATES.IN', placeholder: 'MIFID.RATES.IN' }]
    },
    {
      name: 'query_sybase_locks',
      description: 'Query database locking state and blocking SPIDs on Sybase core clusters.',
      fields: [{ name: 'tableName', type: 'text', defaultValue: 'MIFID_CREDIT_TRADES', placeholder: 'MIFID_CREDIT_TRADES' }]
    },
    {
      name: 'fetch_sftp_routes',
      description: 'Check connectivity routes and gateway status to ECB SFTP servers.',
      fields: [{ name: 'gatewayHost', type: 'text', defaultValue: 'sftp.ecb.europa.eu', placeholder: 'sftp.ecb.europa.eu' }]
    },
    {
      name: 'fetch_compliance_metrics',
      description: 'Query ESMA repository validation metrics and current NACK/rejection ratios.',
      fields: [{ name: 'regulatoryBody', type: 'text', defaultValue: 'ESMA', placeholder: 'ESMA' }]
    },
    {
      name: 'inspect_jvm_heap',
      description: 'Audit live memory allocations, GC pause percentiles, and Heap state.',
      fields: [{ name: 'serviceId', type: 'text', defaultValue: 'db-exman', placeholder: 'db-exman' }]
    },
    {
      name: 'reset_regulatory_socket',
      description: 'Perform emergency socket recycle to clear stuck rate streaming loops.',
      fields: [
        { name: 'queueName', type: 'text', defaultValue: 'MIFID.RATES.IN', placeholder: 'MIFID.RATES.IN' },
        { name: 'socketId', type: 'text', defaultValue: 'rates-tx-prod-918', placeholder: 'rates-tx-prod-918' }
      ]
    },
    {
      name: 'kill_blocking_spid',
      description: 'Terminate an exclusive lock on core transactional databases.',
      fields: [{ name: 'spid', type: 'number', defaultValue: 892, placeholder: '892' }]
    },
    {
      name: 'redeploy_upstream_release',
      description: 'Revert upstream trade delivery releases to a verified build version.',
      fields: [
        { name: 'systemName', type: 'text', defaultValue: 'upstream-trade-capture-engine', placeholder: 'upstream-trade-capture-engine' },
        { name: 'targetVersion', type: 'text', defaultValue: 'v14.1', placeholder: 'v14.1' }
      ]
    },
    {
      name: 'fix_sftp_dns_routes',
      description: 'Inject static gateway route configurations for target isolated VLANs.',
      fields: [
        { name: 'gatewayHost', type: 'text', defaultValue: 'sftp.ecb.europa.eu', placeholder: 'sftp.ecb.europa.eu' },
        { name: 'vlanId', type: 'number', defaultValue: 124, placeholder: '124' }
      ]
    },
    {
      name: 'restart_jvm_container',
      description: 'Force hard recycle on a JVM container instance to clear heap constraints.',
      fields: [{ name: 'serviceId', type: 'text', defaultValue: 'db-exman', placeholder: 'db-exman' }]
    }
  ];

  // Available Resources definition
  const mcpResources = [
    { uri: 'mcp://mifid-rates/ibm-mq-logs', name: 'MIFID RATES Log file' },
    { uri: 'mcp://mifid-credit/sybase-active-spids', name: 'Sybase active SPID list' },
    { uri: 'mcp://compliance/esma-repository-nacks', name: 'ESMA validation rejections diagnostics' },
    { uri: 'mcp://sftp/ecb-routes', name: 'ECB Static SFTP Route Tables' },
    { uri: 'mcp://jvm/exman-heap-state', name: 'JVM heap details' }
  ];

  const fetchMcpLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/mcp/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch MCP logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchDbState = async () => {
    setIsLoadingDb(true);
    try {
      // Query the unified database state endpoint that always returns full state cleanly
      const res = await fetch('/api/demo/regops/state');
      if (res.ok) {
        const data = await res.json();
        setDbState(data);
      } else {
        // Fallback to separate endpoints if the unified state is not yet available
        const ratesRes = await fetch('/api/demo/regops/rates/queue');
        const creditRes = await fetch('/api/demo/regops/credit/locks');
        const validationRes = await fetch('/api/demo/regops/compliance/validation');
        
        const queues = ratesRes.ok ? await ratesRes.json() : { depth: 78401, status: 'STUCK', socketState: 'STALE' };
        const locks = creditRes.ok ? await creditRes.json() : { status: 'BLOCKED', blockedTradesCount: 1402, blockingSpid: 892 };
        const validation = validationRes.ok ? await validationRes.json() : { bugActive: true, version: 'v14.2', nackRate: '12.4%' };
        
        setDbState({ queues, locks, validation });
      }
    } catch (err) {
      console.error('Failed to load DB state:', err);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchMcpLogs();
    fetchDbState();
  }, []);

  const handleToolChange = (toolName: string) => {
    setSelectedTool(toolName);
    const tool = mcpTools.find(t => t.name === toolName);
    if (tool) {
      const initialParams: Record<string, any> = {};
      tool.fields.forEach(f => {
        initialParams[f.name] = f.defaultValue;
      });
      setToolParams(initialParams);
    }
  };

  const handleParamChange = (name: string, val: string) => {
    const tool = mcpTools.find(t => t.name === selectedTool);
    const field = tool?.fields.find(f => f.name === name);
    let parsedVal: any = val;
    if (field?.type === 'number') {
      parsedVal = parseInt(val) || 0;
    }
    setToolParams(prev => ({
      ...prev,
      [name]: parsedVal
    }));
  };

  const callMcpTool = async () => {
    setIsCallingTool(true);
    setToolResult(null);
    const rpcId = 'sandbox_tool_' + Math.floor(Math.random() * 100000);
    const payload = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: selectedTool,
        arguments: toolParams
      },
      id: rpcId
    };

    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setToolResult({
        request: payload,
        response: data
      });
      fetchMcpLogs();
      fetchDbState();
    } catch (err: any) {
      setToolResult({
        request: payload,
        response: { error: { message: err.message || 'Network error executing tool call.' } }
      });
    } finally {
      setIsCallingTool(false);
    }
  };

  const readMcpResource = async () => {
    setIsReadingResource(true);
    setResourceResult(null);
    const rpcId = 'sandbox_resource_' + Math.floor(Math.random() * 100000);
    const payload = {
      jsonrpc: '2.0',
      method: 'resources/read',
      params: {
        uri: selectedResource
      },
      id: rpcId
    };

    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResourceResult({
        request: payload,
        response: data
      });
      fetchMcpLogs();
    } catch (err: any) {
      setResourceResult({
        request: payload,
        response: { error: { message: err.message || 'Network error reading resource.' } }
      });
    } finally {
      setIsReadingResource(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      
      {/* HEADER STATUS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Model Context Protocol (MCP) Dashboard</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Compliant JSON-RPC 2.0 microservice for local DB state & SRE telemetry</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400">Active URL:</span>
            <span className="text-white font-semibold">/api/mcp</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Store:</span>
            <span className="text-blue-400 font-semibold">db_mcp_resources.json</span>
          </div>
          <button 
            onClick={() => { fetchMcpLogs(); fetchDbState(); }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* INTERACTIVE PLAYGROUND (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TOOL SANDBOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Transmit MCP Tool Calls</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">JSON-RPC Method: "tools/call"</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tool Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-500">Select MCP Tool</label>
                <select
                  value={selectedTool}
                  onChange={(e) => handleToolChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {mcpTools.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 font-sans mt-2 italic leading-normal">
                  {mcpTools.find(t => t.name === selectedTool)?.description}
                </p>
              </div>

              {/* Arguments Constructor */}
              <div className="space-y-2.5 md:col-span-2 bg-slate-950 border border-slate-850 rounded-lg p-4">
                <span className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-1.5">Tool Parameters</span>
                
                <div className="space-y-3 pt-1">
                  {mcpTools.find(t => t.name === selectedTool)?.fields.map(f => (
                    <div key={f.name} className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500">{f.name} ({f.type})</span>
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={toolParams[f.name] !== undefined ? toolParams[f.name] : ''}
                        onChange={(e) => handleParamChange(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}

                  <button
                    onClick={callMcpTool}
                    disabled={isCallingTool}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-xs font-bold text-white transition-all cursor-pointer mt-2"
                  >
                    {isCallingTool ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Calling Model Context Protocol server...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        Execute MCP Tool [JSON-RPC]
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Tool Result View */}
            {toolResult && (
              <div className="space-y-2.5 border-t border-slate-800 pt-4">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Transaction Payload Verification</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div>
                    <span className="block text-[9px] text-slate-500 uppercase mb-1">JSON-RPC Request</span>
                    <pre className="p-3 bg-slate-950 border border-slate-850 rounded-lg overflow-x-auto text-blue-300 max-h-[160px] scrollbar-thin scrollbar-thumb-slate-800 leading-normal">
                      {JSON.stringify(toolResult.request, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-500 uppercase mb-1">JSON-RPC Server Response</span>
                    <pre className="p-3 bg-slate-950 border border-slate-850 rounded-lg overflow-x-auto text-emerald-300 max-h-[160px] scrollbar-thin scrollbar-thumb-slate-800 leading-normal">
                      {JSON.stringify(toolResult.response, null, 2)}
                    </pre>
                  </div>
                </div>

                {toolResult.response?.result?.content?.[0] && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-mono text-emerald-400 font-bold uppercase">Result Content Text</span>
                      <p className="text-xs text-slate-200 mt-1 font-sans">{toolResult.response.result.content[0].text}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RESOURCE SANDBOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileCode className="w-4.5 h-4.5 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Query MCP Telemetry Resources</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">JSON-RPC Method: "resources/read"</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-500">Resource URI</label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {mcpResources.map(r => (
                    <option key={r.uri} value={r.uri}>{r.name} ({r.uri})</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 font-sans mt-2">
                  Query active diagnostic reports directly mapped into the Model Context Protocol resource workspace.
                </p>
              </div>

              <div className="md:col-span-2 space-y-3 bg-slate-950 border border-slate-850 rounded-lg p-4">
                <span className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-1.5">Resource Client Request</span>
                
                <div className="text-[11px] font-mono text-slate-400 space-y-1">
                  <div><strong>Protocol:</strong> JSON-RPC 2.0</div>
                  <div><strong>Method:</strong> resources/read</div>
                  <div><strong>Params:</strong> <span className="text-blue-300">{"{"} "uri": "{selectedResource}" {"}"}</span></div>
                </div>

                <button
                  onClick={readMcpResource}
                  disabled={isReadingResource}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  {isReadingResource ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Reading Resource workspace...
                    </>
                  ) : (
                    <>
                      <FileCode className="w-3.5 h-3.5" />
                      Fetch Resource Payload
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resource Result View */}
            {resourceResult && (
              <div className="space-y-2.5 border-t border-slate-800 pt-4">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Response Verification</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div>
                    <span className="block text-[9px] text-slate-500 uppercase mb-1">Request Payload</span>
                    <pre className="p-3 bg-slate-950 border border-slate-850 rounded-lg overflow-x-auto text-blue-300 max-h-[140px] leading-normal">
                      {JSON.stringify(resourceResult.request, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-500 uppercase mb-1">JSON-RPC response payload</span>
                    <pre className="p-3 bg-slate-950 border border-slate-850 rounded-lg overflow-x-auto text-emerald-300 max-h-[140px] leading-normal">
                      {JSON.stringify(resourceResult.response, null, 2)}
                    </pre>
                  </div>
                </div>

                {resourceResult.response?.result?.contents?.[0] && (
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg font-mono text-[11px]">
                    <span className="block text-[9px] text-slate-500 uppercase border-b border-slate-900 pb-1 mb-2">Formatted Resource Content Text</span>
                    <div className="text-slate-300 leading-relaxed whitespace-pre bg-slate-900 p-2.5 rounded border border-slate-850">
                      {resourceResult.response.result.contents[0].text}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RESOURCE MAP & TRANSACTION FEED (4 COLS) */}
        <div className="lg:col-span-4 space-y-6 text-left">
          
          {/* PERSISTENT DB STATE PREVIEW */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">MCP Backend Storage</h3>
              </div>
              <button 
                onClick={fetchDbState} 
                disabled={isLoadingDb}
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
              >
                {isLoadingDb ? 'Reloading...' : 'Refresh'}
              </button>
            </div>

            {dbState ? (
              <div className="space-y-3 font-mono text-[11px]">
                {/* Outbound MIFID queue */}
                <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="font-semibold text-white">MIFID.RATES.IN Queue</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${dbState.queues?.depth > 120 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {dbState.queues?.status || 'HEALTHY'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Queue Depth:</span>
                    <span className="text-slate-300 font-bold">{dbState.queues?.depth} msgs</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Socket State:</span>
                    <span className="text-slate-300">{dbState.queues?.socketState}</span>
                  </div>
                </div>

                {/* Database Locks */}
                <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="font-semibold text-white">Sybase Table Locks</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${dbState.locks?.status === 'BLOCKED' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {dbState.locks?.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Blocked trades:</span>
                    <span className="text-slate-300 font-bold">{dbState.locks?.blockedTradesCount} rows</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Blocking SPID:</span>
                    <span className="text-slate-300">{dbState.locks?.blockingSpid || 'None'}</span>
                  </div>
                </div>

                {/* Validation bug */}
                <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="font-semibold text-white">Compliance Validation</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${dbState.validation?.bugActive ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {dbState.validation?.bugActive ? 'BUG_ACTIVE' : 'STABLE'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Engine Version:</span>
                    <span className="text-slate-300">{dbState.validation?.version}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>NACK Ratio:</span>
                    <span className="text-rose-400 font-bold">{dbState.validation?.nackRate}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                Failed to load backend storage parameters.
              </div>
            )}
          </div>

          {/* LIVE LOG STREAM */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">JSON-RPC Auditing Feed</h3>
              </div>
              <span className="text-[9px] font-mono text-slate-500">Total: {logs.length}</span>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 text-[11px] font-mono scrollbar-thin scrollbar-thumb-slate-800">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">No transactions processed.</div>
              ) : (
                logs.map((log, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedLog(log === selectedLog ? null : log)}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      log.type === 'tools/call' 
                        ? 'bg-blue-950/15 border-blue-950/50 hover:bg-blue-950/35' 
                        : 'bg-slate-950 border-slate-850 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                      <span className="text-blue-400 font-bold uppercase">{log.type}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-300 truncate font-mono text-xs">
                      {log.type === 'tools/call' 
                        ? `Call: ${log.payload?.name || 'unknown'}` 
                        : `Read: ${log.payload?.uri || 'unknown'}`
                      }
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Click to view payload</span>
                      <span className="text-emerald-400 font-semibold">SUCCESS</span>
                    </div>

                    {selectedLog === log && (
                      <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-2 text-[10px] text-left">
                        <div>
                          <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Parameters JSON</span>
                          <pre className="p-2 bg-slate-900 border border-slate-850 rounded text-slate-300 overflow-x-auto whitespace-pre">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5">Result JSON</span>
                          <pre className="p-2 bg-slate-900 border border-slate-850 rounded text-slate-300 overflow-x-auto whitespace-pre">
                            {JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
