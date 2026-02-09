
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  addServer,
  updateServer
} from '../api/client';
import type { ServerProfile } from '../types';

export function StatusBadge({ status }: { status: ServerProfile['status'] }) {
  const styles = {
    online: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
    offline: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
    unknown: "bg-zinc-500"
  };

  return (
    <div className="flex items-center gap-1.5 ml-2">
      <div className={clsx("w-2 h-2 rounded-full", styles[status])} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{status}</span>
    </div>
  );
}

interface ServerModalProps {
  server?: ServerProfile | null;
  onClose: () => void;
}

export function ServerModal({ server, onClose }: ServerModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 4096,
    apiKey: server?.apiKey || '',
    type: server?.type || 'local' as ServerProfile['type'],
    isDefault: server?.isDefault || false
  });

  const mutation = useMutation({
    mutationFn: (data: any) => server
      ? updateServer(server.id, data)
      : addServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-zinc-100">
            {server ? 'Edit Server Profile' : 'Add New Server'}
          </h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors">
            {/* <X size={20} /> */}
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(formData);
          }}
          className="p-8 pt-2 space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Profile Name</label>
              <input
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                placeholder="e.g. Production Cluster"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Host</label>
              <input
                required
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                placeholder="localhost or IP"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Port</label>
              <input
                required
                type="number"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">API Key (Optional)</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                placeholder="••••••••••••••••"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Server Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['local', 'remote-api', 'docker-managed'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={clsx(
                      "px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize",
                      formData.type === type
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    {type.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900"
            />
            <label htmlFor="isDefault" className="text-sm text-zinc-300 font-medium">
              Set as default server for new tasks
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              {mutation.isPending ? 'Saving...' : server ? 'Update Profile' : 'Add Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
