import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Filter, Terminal, Copy, Check } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  agentId: string;
  taskId: string;
  action: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'pending';
}

interface AgentLogViewerProps {
  className?: string;
}

export function AgentLogViewer({ className = '' }: AgentLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    agentId: '',
    taskId: '',
    result: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyAllLogs = () => {
    const text = logs.map(l =>
      `[${new Date(l.timestamp).toLocaleString()}] ${l.agentId} (${l.taskId}): ${l.action} -> ${l.result}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.agentId) params.append('agentId', filters.agentId);
      if (filters.taskId) params.append('taskId', filters.taskId);
      if (filters.result) params.append('result', filters.result);
      params.append('limit', '100');

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [filters]);

  const toggleExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getStatusIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <Terminal className="w-4 h-4 text-zinc-400" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const uniqueAgents = Array.from(new Set(logs.map(l => l.agentId)));
  const uniqueTasks = Array.from(new Set(logs.map(l => l.taskId)));

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg ${className}`}>
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Agent Logs</h2>
            <span className="text-xs text-zinc-500">({logs.length} entries)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyAllLogs}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-bold ${copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Logs'}
            </button>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-bold"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={filters.agentId}
              onChange={(e) => setFilters(prev => ({ ...prev, agentId: e.target.value }))}
              className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Agents</option>
              {uniqueAgents.map(agent => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </div>

          <select
            value={filters.taskId}
            onChange={(e) => setFilters(prev => ({ ...prev, taskId: e.target.value }))}
            className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tickets</option>
            {uniqueTasks.map(task => (
              <option key={task} value={task}>{task}</option>
            ))}
          </select>

          <select
            value={filters.result}
            onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
            className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[600px]">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            Loading logs...
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/10 text-red-500 rounded-full mb-4">
              <Terminal className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-100 font-medium mb-1">Failed to load logs</h3>
            <p className="text-zinc-500 text-sm mb-4">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No logs found
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {logs.map((log, index) => {
              const logId = `${log.timestamp}-${index}`;
              const isExpanded = expandedLogs.has(logId);
              const hasDetails = Object.keys(log.details).length > 0;

              return (
                <div key={logId} className="p-3 hover:bg-zinc-800/50 transition-colors">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => hasDetails && toggleExpanded(logId)}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {hasDetails ? (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(log.result)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-zinc-400">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                          {log.agentId}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                          {log.taskId}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-300">
                        {log.action}
                      </div>

                      {isExpanded && hasDetails && (
                        <div className="mt-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg relative group/detail">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold text-zinc-400">Details</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
                              }}
                              className="p-1 px-2 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 rounded transition-all flex items-center gap-1 opacity-0 group-hover/detail:opacity-100"
                            >
                              <Copy size={10} /> Copy JSON
                            </button>
                          </div>
                          <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
