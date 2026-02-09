import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import type { Ticket } from '../types';

interface TicketCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepository?: string | null;
}

const createTicket = async (ticketData: {
  title: string;
  description?: string;
  priority: Ticket['priority'];
  skill?: string;
  category?: string;
  repository?: string;
}): Promise<Ticket> => {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create ticket');
  }

  const data = await response.json();
  return data.ticket;
};

export function TicketCreationModal({ isOpen, onClose, selectedRepository }: TicketCreationModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('medium');
  const [category, setCategory] = useState('');

  // New selections
  const [activeIntegrations, setActiveIntegrations] = useState<string[]>([]);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [contextOptions, setContextOptions] = useState<{ integrations: any[], mcps: string[], skills?: string[] }>({ integrations: [], mcps: [] });

  // Load options
  useEffect(() => {
    if (isOpen) {
      fetch('/api/context/options')
        .then(r => r.json())
        .then(data => setContextOptions(data))
        .catch(e => console.error('Failed to load context options', e));
    }
  }, [isOpen]);

  const createTicketMutation = useMutation({
    mutationFn: (ticketData: any) => createTicket(ticketData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      resetForm();
      onClose();
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setActiveIntegrations([]);
    setActiveSkills([]);
  };

  const [copied, setCopied] = useState(false);

  const copyDraft = () => {
    const integrationNames = activeIntegrations.map(id =>
      contextOptions.integrations.find((i: any) => i.id === id)?.name || id
    );
    const text = [
      `[DRAFT] ${title || 'Untitled Ticket'}`,
      `Priority: ${priority}`,
      `Category: ${category || 'None'}`,
      `Skills: ${activeSkills.join(', ') || 'General'}`,
      `---`,
      `Description:`,
      description || 'No description',
      `---`,
      `Integrations: ${integrationNames.join(', ') || 'None'}`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    createTicketMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: category.trim() || undefined,
      repository: selectedRepository || undefined,
      active_integrations: activeIntegrations,
      active_skills: activeSkills,
      skill: activeSkills[0] || 'general' // Primary skill for legacy compatibility
    });
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const toggleSelection = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(i => i !== id) : [...list, id]);
  };

  // Keyboard & Click handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel]);

  if (!isOpen) return null;

  const handleFocus = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement> | React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).select();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleCancel}
      />
      <div className="relative bg-zinc-900 rounded-3xl border border-zinc-800 p-8 w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Create New Ticket</h2>
          <button
            type="button"
            onClick={copyDraft}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100'
              }`}
            title="Copy current draft to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Draft'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onMouseEnter={handleFocus}
                onFocus={handleFocus}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/50 text-zinc-100 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                placeholder="Enter ticket title"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onMouseEnter={handleFocus}
                onFocus={handleFocus}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/50 text-zinc-100 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none text-sm"
                placeholder="Nextcloud path, instructions, etc."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="priority" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Priority
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
                  className="w-full px-4 py-3 bg-zinc-800/50 text-zinc-100 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label htmlFor="category" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Category
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onMouseEnter={handleFocus}
                  onFocus={handleFocus}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 text-zinc-100 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="e.g., ui, core, docs"
                />
              </div>
            </div>

            {/* Selection Areas */}
            <div className="space-y-6 pt-4 border-t border-zinc-800">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Agent Skills (Multi-Select)</label>
                <div className="flex flex-wrap gap-2">
                  {contextOptions.skills?.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSelection(s, activeSkills, setActiveSkills)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeSkills.includes(s)
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                        }`}
                    >
                      /{s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">API Integrations (Multi-Select)</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {Array.isArray(contextOptions.integrations) ? contextOptions.integrations.map(int => (
                    <button
                      key={int.id}
                      type="button"
                      onClick={() => toggleSelection(int.id, activeIntegrations, setActiveIntegrations)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all border ${activeIntegrations.includes(int.id)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                        }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${activeIntegrations.includes(int.id) ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-700'}`} />
                      <span className="text-xs font-medium truncate">{int.name}</span>
                    </button>
                  )) : (
                    <span className="text-xs text-zinc-600 italic px-2 col-span-2">No integrations found.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {createTicketMutation.isError && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl p-3">
              {createTicketMutation.error instanceof Error
                ? createTicketMutation.error.message
                : 'Failed to create ticket'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              disabled={createTicketMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              disabled={!title.trim() || createTicketMutation.isPending}
            >
              {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
