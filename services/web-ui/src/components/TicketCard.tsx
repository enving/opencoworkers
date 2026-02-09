import { CheckCircle, Clock, AlertCircle, Shield, GripVertical, RotateCcw, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import type { Ticket } from '../types';

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  onRefine?: (ticket: Ticket) => void;
  onClick?: (ticket: Ticket) => void;
  onInspect?: (ticketId: string) => void;
}

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

export function TicketCard({ ticket, isDragging = false, onRefine, onClick, onInspect }: TicketCardProps) {
  return (
    <div
      onClick={() => onClick?.(ticket)}
      className={clsx(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 transition-all duration-300 cursor-grab active:cursor-grabbing group',
        isDragging
          ? 'shadow-2xl scale-[1.02] -rotate-1 border-indigo-500 z-50 ring-4 ring-indigo-500/20'
          : 'hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5'
      )}
    >
      <div className="flex items-start gap-4">
        <GripVertical size={14} className="text-zinc-300 dark:text-zinc-600 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg uppercase tracking-tight border border-zinc-200 dark:border-zinc-700/50">
                {ticket.id.replace('TASK-', 'TICKET-')}
              </span>
              {ticket.skill && (
                <span className="text-[10px] font-extrabold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                  /{ticket.skill}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onInspect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(ticket.id);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90"
                  title="View Session Logs"
                >
                  <FileText size={12} />
                </button>
              )}
              {(ticket.status === 'completed' || ticket.status === 'in_review') && onRefine && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefine(ticket);
                  }}
                  className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all active:scale-90"
                  title="Refine Ticket"
                >
                  <RotateCcw size={12} />
                </button>
              )}
              {ticket.verified && (
                <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                  <Shield size={12} fill="currentColor" fillOpacity={0.2} />
                </div>
              )}
            </div>
          </div>

          <h3 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mb-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {ticket.title}
          </h3>

          {ticket.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed font-medium">
              {ticket.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.category && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30 px-2 py-0.5 rounded-full border border-zinc-100 dark:border-zinc-800/50">
                {ticket.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
