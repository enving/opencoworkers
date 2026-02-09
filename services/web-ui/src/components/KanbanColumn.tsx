import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import type { Ticket } from '../types';
import { TicketCard } from './TicketCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  tickets: Ticket[];
  onRefine?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
  onTicketClick?: (ticket: Ticket) => void;
  onInspectTicket?: (ticketId: string) => void;
}

export function KanbanColumn({ id, title, tickets, onRefine, onDelete, onTicketClick, onInspectTicket }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      data-column-id={id}
      className={`flex flex-col h-full min-h-[500px] bg-zinc-950/30 border rounded-lg p-4 transition-colors ${isOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800/50'
        }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
        <span className="text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full">
          {tickets.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {tickets.map(ticket => (
          <SortableTicketCard 
            key={ticket.id} 
            ticket={ticket} 
            onRefine={onRefine} 
            onDelete={onDelete} 
            onClick={onTicketClick}
            onInspect={onInspectTicket} 
          />
        ))}
      </div>
    </div>
  );
}

function SortableTicketCard({ ticket, onRefine, onDelete, onClick, onInspect }: { 
  ticket: Ticket; 
  onRefine?: (ticket: Ticket) => void; 
  onDelete?: (ticket: Ticket) => void; 
  onClick?: (ticket: Ticket) => void;
  onInspect?: (ticketId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onDelete?.(ticket);
    } else if (e.key === 'Enter' || e.key === ' ') {
      onClick?.(ticket);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-2xl"
    >
      <TicketCard ticket={ticket} onRefine={onRefine} onClick={onClick} onInspect={onInspect} />
    </div>
  );
}
