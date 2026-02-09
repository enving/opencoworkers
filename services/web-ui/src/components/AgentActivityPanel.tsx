import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, AlertCircle, ArrowRightLeft, FileText, X } from 'lucide-react';

interface AgentActivity {
  agentId: string;
  status: 'idle' | 'working' | 'handing_off' | 'error';
  activeTicketId?: string;
  lastAction: string;
  timestamp: string;
}

interface AgentActivityPanelProps {
  inspectingTicketId?: string | null;
  onCloseInspection?: () => void;
}

export function AgentActivityPanel({ inspectingTicketId, onCloseInspection }: AgentActivityPanelProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [internalInspectingTicket, setInternalInspectingTicket] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Derived state to handle both external prop control and internal control
  const activeInspection = inspectingTicketId || internalInspectingTicket;
  const handleCloseInspection = () => {
    setInternalInspectingTicket(null);
    onCloseInspection?.();
  };

  const fetchSessionLogs = async (ticketId: string) => {
    try {
      setLoadingLogs(true);
      setSessionLogs([]);
      // Update both for robustness, though one usually suffices depending on caller
      setInternalInspectingTicket(ticketId);
      if (inspectingTicketId !== ticketId && onCloseInspection) {
        // If driven by parent, we might not need this, but let's leave internal state for now
        // Actually, if driven by parent, parent state updates `inspectingTicketId`.
      }

      const response = await fetch(`/api/tickets/${ticketId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setSessionLogs(data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // React to prop change
  useEffect(() => {
    if (inspectingTicketId) {
      fetchSessionLogs(inspectingTicketId);
    }
  }, [inspectingTicketId]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.addEventListener('connected', () => {
      setConnected(true);
    });

    eventSource.addEventListener('ticket_created', (event) => {
      const data = JSON.parse(event.data);
      const activity: AgentActivity = {
        agentId: 'system',
        status: 'working',
        activeTicketId: data.ticket.id,
        lastAction: `Created new ticket: ${data.ticket.title}`,
        timestamp: data.timestamp
      };
      setActivities(prev => [activity, ...prev.slice(0, 9)]);
    });

    eventSource.addEventListener('ticket_deleted', (event) => {
      const data = JSON.parse(event.data);
      const activity: AgentActivity = {
        agentId: 'system',
        status: 'working',
        activeTicketId: data.ticketId,
        lastAction: `Removed ticket ${data.ticketId}`,
        timestamp: data.timestamp
      };
      setActivities(prev => [activity, ...prev.slice(0, 9)]);
    });

    eventSource.addEventListener('ticket_updated', (event) => {
      const data = JSON.parse(event.data);
      const activity: AgentActivity = {
        agentId: 'system',
        status: 'working',
        activeTicketId: data.ticketId,
        lastAction: `Updated ticket ${data.ticketId}`,
        timestamp: data.timestamp
      };
      setActivities(prev => [activity, ...prev.slice(0, 9)]);
    });

    eventSource.addEventListener('ticket_context_updated', (event) => {
      const data = JSON.parse(event.data);
      const activity: AgentActivity = {
        agentId: 'system',
        status: 'working',
        activeTicketId: data.ticketId,
        lastAction: `Adjusted context for ${data.ticketId}`,
        timestamp: data.timestamp
      };
      setActivities(prev => [activity, ...prev.slice(0, 9)]);
    });

    eventSource.addEventListener('agent_started', (event) => {
      const data = JSON.parse(event.data);
      setActivities(prev => {
        // Filter duplicates and older system entries for the same ticket
        const filtered = prev.filter(a => a.activeTicketId !== data.taskId);
        const activity: AgentActivity = {
          agentId: data.agentId || 'system',
          status: 'working',
          activeTicketId: data.taskId, // Backend might still send taskId
          lastAction: `Working on ${data.taskId}`,
          timestamp: data.timestamp || new Date().toISOString()
        };
        return [activity, ...filtered.slice(0, 8)];
      });
    });

    eventSource.addEventListener('agent_completed', (event) => {
      const data = JSON.parse(event.data);
      setActivities(prev => {
        const filtered = prev.filter(a => a.activeTicketId !== data.taskId);
        const activity: AgentActivity = {
          agentId: data.agentId,
          status: 'idle',
          activeTicketId: data.taskId,
          lastAction: `Completed ${data.taskId}`,
          timestamp: data.timestamp
        };
        return [activity, ...filtered.slice(0, 8)];
      });
    });

    eventSource.addEventListener('agent_output', (event) => {
      const data = JSON.parse(event.data);
      // data matches a bridged message part update
      // We need to map this to the active inspection if possible
      // The event likely has sessionID, but we track ticketID.
      // For MVP, we'll blindly update if we have logs open, assuming 1 active session per user context or just filter if we can.

      setSessionLogs(prevLogs => {
        if (prevLogs.length === 0) return prevLogs;

        const lastMsg = { ...prevLogs[prevLogs.length - 1] };
        if (lastMsg.role !== 'assistant') {
          // Create new placeholder if last was user
          return [...prevLogs, { role: 'assistant', parts: [{ type: 'text', text: '' }] }];
        }

        // Simple append for text updates (token stream)
        if (data.delta) {
          const newParts = [...(lastMsg.parts || [])];
          if (newParts.length > 0 && newParts[newParts.length - 1].type === 'text') {
            newParts[newParts.length - 1].text += data.delta;
          } else {
            newParts.push({ type: 'text', text: data.delta });
          }
          lastMsg.parts = newParts;
          return [...prevLogs.slice(0, -1), lastMsg];
        }
        return prevLogs;
      });
    });

    eventSource.addEventListener('agent_thought', (event) => {
      const data = JSON.parse(event.data);

      setActivities(prev => prev.map(a => {
        if (a.activeTicketId === data.taskId) {
          return {
            ...a,
            lastAction: `Thinking: ${data.content.slice(0, 50)}${data.content.length > 50 ? '...' : ''}`,
            timestamp: new Date().toISOString()
          };
        }
        return a;
      }));

      if (activeInspection === data.taskId) {
        setSessionLogs(prevLogs => {
          if (prevLogs.length === 0) {
            return [{ role: 'assistant', parts: [{ type: 'thinking', text: data.content, thoughtId: data.thoughtId, isComplete: data.isComplete }] }];
          }

          const lastMsg = { ...prevLogs[prevLogs.length - 1] };
          if (lastMsg.role !== 'assistant') {
            return [...prevLogs, { role: 'assistant', parts: [{ type: 'thinking', text: data.content, thoughtId: data.thoughtId, isComplete: data.isComplete }] }];
          }

          const newParts = [...(lastMsg.parts || [])];
          const existingThoughtIdx = newParts.findIndex(p => p.thoughtId === data.thoughtId);

          if (existingThoughtIdx !== -1) {
            newParts[existingThoughtIdx] = {
              ...newParts[existingThoughtIdx],
              text: data.content,
              isComplete: data.isComplete
            };
          } else {
            newParts.push({
              type: 'thinking',
              text: data.content,
              thoughtId: data.thoughtId,
              isComplete: data.isComplete
            });
          }

          lastMsg.parts = newParts;
          return [...prevLogs.slice(0, -1), lastMsg];
        });
      }
    });

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost. Retrying...');
    };

    return () => {
      eventSource.close();
    };
  }, [retryCount]);

  const handleReconnect = () => {
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    const fetchActiveAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          const activeAgents = data.agents.map((agent: any) => ({
            agentId: agent.agentId || 'system',
            status: 'working',
            activeTicketId: agent.taskId,
            lastAction: `Working on ${agent.taskId} (${agent.skill})`,
            timestamp: agent.startedAt
          }));
          // Merge with existing or set initial
          setActivities(prev => {
            if (prev.length === 0) return activeAgents;
            return prev;
          });
        }
      } catch (e) {
        console.error('Failed to fetch initial agents', e);
      }
    };

    fetchActiveAgents();
  }, [retryCount]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl ${activities.some(a => a.status === 'working') ? 'animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.2)]' : ''}`}>
            <Activity size={18} />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
            Live Monitor
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
            {activities.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
        {error ? (
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full mb-4">
              <AlertCircle size={20} />
            </div>
            <p className="text-zinc-900 dark:text-zinc-100 font-medium text-sm mb-1">{error}</p>
            <p className="text-zinc-500 text-xs mb-4">Remote server unreachable</p>
            <button
              onClick={handleReconnect}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95"
            >
              Force Reconnect
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-50 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 rounded-full mb-4">
              <Activity size={20} />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs px-8">
              {connected ? 'Standing by. Awaiting agent events from VPS...' : 'Establishing encrypted stream...'}
            </p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div
              key={`${activity.agentId}-${activity.activeTicketId}-${index}`}
              onClick={() => activity.activeTicketId && fetchSessionLogs(activity.activeTicketId)}
              className={`bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 rounded-xl p-3.5 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all duration-200 ${activity.activeTicketId ? 'cursor-pointer group' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${activity.status === 'working' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 animate-pulse' :
                    activity.status === 'handing_off' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500' :
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}>
                    {activity.status === 'working' ? <Clock size={16} /> :
                      activity.status === 'handing_off' ? <ArrowRightLeft size={16} /> :
                        <CheckCircle size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {activity.agentId}
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold tracking-tighter truncate">
                      {activity.activeTicketId || 'IDLE'}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium flex items-start gap-2 leading-tight">
                  <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mt-1.5 flex-shrink-0" />
                  {activity.lastAction}
                </div>

                {activity.activeTicketId && (
                  <div
                    className="ml-2 p-1.5 text-zinc-400 group-hover:text-indigo-500 rounded-lg transition-colors"
                    title="View Remote Session Logs"
                  >
                    <FileText size={14} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {activeInspection && (
        <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-sm z-50 flex flex-col p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" />
              Session Logs: {activeInspection}
            </h4>
            <button
              onClick={handleCloseInspection}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 bg-black/50 rounded-xl border border-zinc-800 p-4 overflow-y-auto font-mono text-xs">
            {loadingLogs ? (
              <div className="flex items-center justify-center h-full text-zinc-500">
                <Clock className="animate-spin mr-2" size={16} /> Loading remote transcript...
              </div>
            ) : sessionLogs.length === 0 ? (
              <div className="text-zinc-500 text-center mt-10">No messages found for this session.</div>
            ) : (
              <div className="space-y-4">
                {sessionLogs.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'assistant' ? 'pl-4 border-l-2 border-indigo-500/30' : 'pr-4'}`}>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">
                      {msg.role}
                    </div>
                    <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {msg.parts?.map((p: any, i: number) => {
                        if (p.type === 'thinking' || p.type === 'reasoning') {
                          return (
                            <div key={i} className="my-2 p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-indigo-300/90 text-xs font-mono">
                              <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] uppercase tracking-wider font-bold">
                                <span className={p.isComplete ? "" : "animate-pulse"}>🧠</span> {p.isComplete ? "Thought Process" : "Thinking..."}
                              </div>
                              <div className="pl-1 border-l border-indigo-500/20">
                                {p.text}
                                {!p.isComplete && <span className="inline-block w-1.5 h-3 ml-1 bg-indigo-400 animate-blink align-middle"></span>}
                              </div>
                            </div>
                          );
                        }
                        if (p.type === 'text') {
                          // Parse <think> blocks, including incomplete ones during streaming
                          const text = p.text;
                          // Regex to find complete blocks
                          const parts = text.split(/(<think>[\s\S]*?<\/think>)/g);

                          return (
                            <span key={i}>
                              {parts.map((part: string, pIdx: number) => {
                                // Case 1: Complete <think> block
                                if (part.startsWith('<think>') && part.endsWith('</think>')) {
                                  const content = part.replace(/<\/?think>/g, '').trim();
                                  return (
                                    <div key={pIdx} className="my-2 p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-indigo-300/90 text-xs font-mono">
                                      <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] uppercase tracking-wider font-bold">
                                        <span className="animate-pulse">🧠</span> Thought Process
                                      </div>
                                      <div className="pl-1 border-l border-indigo-500/20">
                                        {content}
                                      </div>
                                    </div>
                                  );
                                }

                                // Case 2: Incomplete <think> block (streaming)
                                if (part.includes('<think>') && !part.includes('</think>')) {
                                  const [before, ...rest] = part.split('<think>');
                                  const activeContent = rest.join('<think>'); // Rejoin if multiple (unlikely)

                                  // Render pre-text if any
                                  return (
                                    <span key={pIdx}>
                                      {before && <span>{before}</span>}
                                      <div className="my-2 p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-indigo-300/90 text-xs font-mono animate-pulse">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] uppercase tracking-wider font-bold">
                                          <span className="animate-spin">🧠</span> Thinking...
                                        </div>
                                        <div className="pl-1 border-l border-indigo-500/20">
                                          {activeContent}
                                          <span className="inline-block w-1.5 h-3 ml-1 bg-indigo-400 animate-blink align-middle"></span>
                                        </div>
                                      </div>
                                    </span>
                                  );
                                }

                                // Case 3: Normal text
                                const cleanPart = part.replace(/<\/?final>/g, '');
                                return <span key={pIdx}>{cleanPart}</span>;
                              })}
                            </span>
                          );
                        }
                        if (p.type === 'tool_use' || p.type === 'tool') return (
                          <div key={i} className="my-2 p-2 bg-zinc-900 border border-zinc-800 rounded text-amber-500/80">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                {p.state?.status === 'running' ? '⚡ Running Tool' : '🛠️ Tool Call'}
                              </span>
                              <span className="text-xs font-mono text-amber-400">{p.name || p.tool}</span>
                            </div>
                            {p.state?.input && (
                              <pre className="p-2 bg-black/30 rounded border border-amber-900/20 text-[10px] text-amber-200/70 overflow-x-auto">
                                {JSON.stringify(p.state.input, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                        if (p.type === 'tool_result') return (
                          <div key={i} className="my-2 p-2 bg-zinc-950 border border-zinc-800 rounded group">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-emerald-600 mb-1">
                              <CheckCircle size={12} /> Tool Output
                            </div>
                            <div className="text-xs font-mono text-emerald-500/80 truncate group-hover:whitespace-pre-wrap group-hover:break-words">
                              Result from {p.tool_use_id}
                            </div>
                          </div>
                        );
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
