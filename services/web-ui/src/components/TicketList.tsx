import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertCircle, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { fetchTickets } from '../api/client';
import type { Ticket } from '../types';

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const config = {
    pending: { icon: Clock, bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
    in_progress: { icon: Clock, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    in_review: { icon: Shield, bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
    completed: { icon: CheckCircle, bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    cancelled: { icon: AlertCircle, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    blocked: { icon: AlertCircle, bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  };
  
  const { icon: Icon, bg, text, border } = config[status];
  
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', bg, text, border)}>
      <Icon size={10} />
      {status.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const config = {
    low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium border', config[priority])}>
      {priority}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-zinc-500">{ticket.id.replace('TASK-', 'TICKET-')}</span>
            {ticket.verified && (
              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
                <Shield size={10} />
                verified
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-zinc-100 truncate">{ticket.title}</h3>
          {ticket.description && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{ticket.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        {ticket.category && (
          <span className="text-[10px] text-zinc-600">{ticket.category}</span>
        )}
      </div>
    </div>
  );
}

export function TicketList() {
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        Loading tickets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-red-400 text-sm">
        <AlertCircle size={16} />
        {error instanceof Error ? error.message : 'Failed to load tickets'}
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        No tickets found.
      </div>
    );
  }

  const pendingTickets = tickets.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTickets = tickets.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Active Tickets ({pendingTickets.length})
        </h2>
        <div className="space-y-2">
          {pendingTickets.slice(0, 20).map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </section>
      
      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Completed ({completedTickets.length})
        </h2>
        <div className="space-y-2">
          {completedTickets.slice(0, 10).map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </section>
    </div>
  );
}
