import { X, ExternalLink, Calendar, Tag, User, Layers, FileText, Download, Users, Edit3, Trash2, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Ticket } from '../types';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (ticket: Ticket) => void;
  onInspect?: (ticketId: string) => void;
}

export function TicketDetailModal({ ticket, isOpen, onClose, onDelete, onInspect }: TicketDetailModalProps) {
  const [editingFile, setEditingFile] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextOptions, setContextOptions] = useState<{ integrations: any[], mcps: string[], skills?: string[] }>({ integrations: [], mcps: [] });

  const [activeIntegrations, setActiveIntegrations] = useState<string[]>([]);
  const [activeMcps, setActiveMcps] = useState<string[]>([]);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);

  // Load real options
  useEffect(() => {
    if (isOpen) {
      fetch('/api/context/options')
        .then(r => r.json())
        .then(data => setContextOptions(data))
        .catch(e => console.error('Failed to load context options', e));
    }
  }, [isOpen]);

  // Sync state with ticket
  useEffect(() => {
    if (ticket) {
      setActiveIntegrations(ticket.active_integrations || []);
      setActiveMcps(ticket.active_mcps || []);
      setActiveSkills(ticket.active_skills || []);
    }
  }, [ticket]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !ticket) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Delete') {
        if (confirm(`Do you really want to delete ticket "${ticket.title}"?`)) {
          onDelete?.(ticket);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ticket, onClose, onDelete]);

  // Debounced auto-save for context
  useEffect(() => {
    if (!ticket) return;

    const timer = setTimeout(async () => {
      // Prevent redundant saves if data matches what's already in the ticket object
      if (
        JSON.stringify(activeIntegrations) === JSON.stringify(ticket.active_integrations || []) &&
        JSON.stringify(activeMcps) === JSON.stringify(ticket.active_mcps || []) &&
        JSON.stringify(activeSkills) === JSON.stringify(ticket.active_skills || [])
      ) {
        return;
      }

      try {
        await fetch(`/api/tickets/${ticket.id}/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active_integrations: activeIntegrations,
            active_mcps: activeMcps,
            active_skills: activeSkills
          })
        });
      } catch (err) {
        console.error('Failed to save context:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeIntegrations, activeMcps, activeSkills, ticket]);

  const updateTicketContext = (key: 'active_integrations' | 'active_mcps' | 'active_skills', value: string[]) => {
    // Only update local state, useEffect handles saving
    if (key === 'active_integrations') setActiveIntegrations(value);
    if (key === 'active_mcps') setActiveMcps(value);
    if (key === 'active_skills') setActiveSkills(value);
  };

  const copyTicketSummary = () => {
    if (!ticket) return;
    const text = [
      `[${ticket.id}] ${ticket.title}`,
      `Status: ${ticket.status}`,
      `Priority: ${ticket.priority}`,
      `Skill: ${ticket.skill || 'General'}`,
      `---`,
      `Description:`,
      ticket.description || 'No description',
      `---`,
      `Active Context:`,
      `- Integrations: ${activeIntegrations.join(', ') || 'None'}`,
      `- MCPs: ${activeMcps.join(', ') || 'None'}`,
      `- Skills: ${activeSkills.join(', ') || 'None'}`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSelection = (list: string[], item: string) => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  if (!ticket || !isOpen) return null;

  const isEditable = (name: string) => {
    return ['.docx', '.xlsx', '.pptx', '.pdf'].some(ext => name.toLowerCase().endsWith(ext));
  };

  const editorUrl = editingFile
    ? `/api/editor/?file=${editingFile.name}&taskId=${ticket.id}`
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded-lg">
                {ticket.id.replace('TASK-', 'TICKET-')}
              </span>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${ticket.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                ticket.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">{ticket.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => ticket && onInspect?.(ticket.id)}
              className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-transparent hover:border-indigo-500/20"
              title="View Agent Logs"
            >
              <FileText size={18} />
              Logs
            </button>
            <button
              onClick={copyTicketSummary}
              className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              title="Copy Summary"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Description</h3>
            <div className="text-zinc-300 leading-relaxed bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
              {ticket.description || 'No description provided.'}
            </div>
          </div>

          {/* Refinement History */}
          {ticket.refinement_loop && ticket.refinement_loop > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Refinement History</h3>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold">
                  Loop #{ticket.refinement_loop}
                </span>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Edit3 size={14} className="text-amber-400" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-amber-300">Refinement Requested</span>
                      <span className="text-xs text-zinc-500">
                        {ticket.updated ? new Date(ticket.updated).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    {ticket.refinement_feedback && (
                      <div className="text-sm text-zinc-300 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                        {ticket.refinement_feedback}
                      </div>
                    )}
                    {ticket.refinement_context && (
                      <details className="text-xs text-zinc-500 cursor-pointer">
                        <summary className="hover:text-zinc-400 transition-colors">View full context</summary>
                        <pre className="mt-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-x-auto whitespace-pre-wrap">
                          {ticket.refinement_context}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Context Selector (TASK-184) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Active Context (Multi-Select)</h3>
            <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50 grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Integrations */}
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">API Integrations</label>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {Array.isArray(contextOptions.integrations) ? contextOptions.integrations.map((int: any) => (
                    <label key={int.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg cursor-pointer hover:border-indigo-500/50 transition-colors">
                      <input
                        type="checkbox"
                        className="accent-indigo-500 w-4 h-4 rounded"
                        checked={activeIntegrations.includes(int.id)}
                        onChange={() => updateTicketContext('active_integrations', toggleSelection(activeIntegrations, int.id))}
                      />
                      <span className="text-xs font-medium text-zinc-300 truncate" title={int.name}>{int.name}</span>
                    </label>
                  )) : (
                    <span className="text-xs text-zinc-600 italic px-2">No integrations found.</span>
                  )}
                </div>
              </div>

              {/* MCP Servers */}
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">MCP Servers</label>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {contextOptions.mcps.length > 0 ? contextOptions.mcps.map((srv: string) => (
                    <label key={srv} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                      <input
                        type="checkbox"
                        className="accent-emerald-500 w-4 h-4 rounded"
                        checked={activeMcps.includes(srv)}
                        onChange={() => updateTicketContext('active_mcps', toggleSelection(activeMcps, srv))}
                      />
                      <span className="text-xs font-medium text-zinc-300 truncate">{srv}</span>
                    </label>
                  )) : (
                    <span className="text-xs text-zinc-600 italic px-2">No MCP servers detected.</span>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Agent Skills</label>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {contextOptions.skills && contextOptions.skills.map((skill: string) => (
                    <label key={skill} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg cursor-pointer hover:border-amber-500/50 transition-colors">
                      <input
                        type="checkbox"
                        className="accent-amber-500 w-4 h-4 rounded"
                        checked={activeSkills.includes(skill) || ticket?.skill === skill}
                        onChange={() => updateTicketContext('active_skills', toggleSelection(activeSkills, skill))}
                      />
                      <span className="text-xs font-medium text-zinc-300 truncate">/{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-1">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Tag size={12} />
                <span>Priority</span>
              </div>
              <p className="text-zinc-100 font-semibold capitalize">{ticket.priority}</p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-1">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Layers size={12} />
                <span>Category</span>
              </div>
              <p className="text-zinc-100 font-semibold">{ticket.category || 'Uncategorized'}</p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-1">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <User size={12} />
                <span>Skill</span>
              </div>
              <p className="text-indigo-400 font-mono font-bold italic">{ticket.skill ? `/${ticket.skill}` : 'General'}</p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-1">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Calendar size={12} />
                <span>Created</span>
              </div>
              <p className="text-zinc-100 font-semibold">
                {new Date(ticket.created).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Links */}
          {((ticket.external_refs && ticket.external_refs.length > 0) || (ticket.artifacts && ticket.artifacts.length > 0)) && (
            <div className="space-y-6">
              {ticket.artifacts && ticket.artifacts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Generated Artifacts</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {ticket.artifacts.map(artifact => (
                      <div
                        key={artifact.name}
                        className="flex items-center gap-2"
                      >
                        <a
                          href={artifact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-between px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-sm font-medium hover:bg-emerald-500/20 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <FileText size={18} />
                            <span className="truncate max-w-[300px]">{artifact.name}</span>
                          </div>
                          <Download size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>

                        {isEditable(artifact.name) && (
                          <button
                            onClick={() => setEditingFile(artifact)}
                            className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl hover:bg-indigo-500/20 transition-all group"
                            title="Edit in Team"
                          >
                            <Users size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ticket.external_refs && ticket.external_refs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">External References</h3>
                  <div className="flex flex-wrap gap-2">
                    {ticket.external_refs.map(ref => (
                      <a
                        key={ref}
                        href="#"
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium hover:bg-blue-500/20 transition-all"
                      >
                        <ExternalLink size={14} />
                        {ref}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fullscreen Editor Overlay */}
        {editingFile && (
          <div className="absolute inset-0 z-50 bg-zinc-950 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
              <div className="flex items-center gap-3">
                <Users className="text-indigo-400" size={18} />
                <span className="text-zinc-100 font-semibold">{editingFile.name}</span>
                <span className="text-xs text-zinc-500 font-mono bg-zinc-800 px-2 py-0.5 rounded">Team Collaboration Mode</span>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all border border-zinc-700 hover:border-red-500/50"
              >
                Close Editor
              </button>
            </div>
            <iframe
              src={editorUrl}
              className="flex-1 w-full border-none bg-white"
              title="OnlyOffice Editor"
            />
          </div>
        )}

        {/* Footer */}
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-between items-center">
          <button
            onClick={() => {
              if (ticket && confirm(`Do you really want to delete ticket "${ticket.title}"?`)) {
                onDelete?.(ticket);
                onClose();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"
          >
            <Trash2 size={16} />
            Delete Ticket
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}