import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { fetchTickets, updateTicket, deleteTicket } from '../api/client';
import { KanbanColumn } from './KanbanColumn';
import { TicketCard } from './TicketCard';
import { RepoSelector } from './RepoSelector';
import { TicketCreationModal } from './TicketCreationModal';
import { RefinementModal } from './RefinementModal';
import { TicketDetailModal } from './TicketDetailModal';
import type { Ticket } from '../types';

type ColumnId = 'backlog' | 'in_progress' | 'review' | 'done';

interface Column {
  id: ColumnId;
  title: string;
  status: Ticket['status'][];
}

const COLUMNS: Column[] = [
  { id: 'backlog', title: 'Backlog', status: ['pending'] },
  { id: 'in_progress', title: 'In Progress', status: ['in_progress'] },
  { id: 'review', title: 'Review', status: ['in_review'] },
  { id: 'done', title: 'Done', status: ['completed', 'cancelled'] },
];

interface KanbanBoardProps {
  onInspectTicket?: (ticketId: string) => void;
}

export function KanbanBoard({ onInspectTicket }: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refiningTicket, setRefiningTicket] = useState<Ticket | null>(null);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const queryClient = useQueryClient();

  const deleteTicketMutation = useMutation({
    mutationFn: (ticket: Ticket) => deleteTicket(ticket.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const { data: allTickets = [], isLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 10000,
  });

  const tickets = selectedRepo
    ? allTickets.filter(ticket => ticket.repository === selectedRepo)
    : allTickets;

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Ticket> }) =>
      updateTicket(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getColumnTickets = (columnId: ColumnId): Ticket[] => {
    const column = COLUMNS.find(c => c.id === columnId);
    if (!column) return [];
    return tickets.filter(ticket => column.status.includes(ticket.status));
  };

  const getNewStatus = (columnId: ColumnId): Ticket['status'] => {
    switch (columnId) {
      case 'backlog':
        return 'pending';
      case 'in_progress':
        return 'in_progress';
      case 'review':
        return 'in_review';
      case 'done':
        return 'completed';
      default:
        return 'pending';
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find(t => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);

    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const targetColumnId = over.id as ColumnId;

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const newStatus = getNewStatus(targetColumnId);
    if (ticket.status === newStatus) return;

    queryClient.setQueryData(['tickets'], (old: Ticket[] = []) =>
      old.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    updateTicketMutation.mutate({
      id: ticketId,
      updates: { status: newStatus },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded" />
          <div className="h-8 w-64 bg-zinc-800 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-96 bg-zinc-900/50 border border-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center p-8">
        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-100 mb-2">Connection Error</h3>
        <p className="text-sm text-zinc-500 max-w-xs mb-6">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          Try Reconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-100">Tickets</h1>
        <div className="flex items-center gap-3">
          <RepoSelector onRepoChange={setSelectedRepo} />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(column => (
            <SortableContext
              key={column.id}
              id={column.id}
              items={getColumnTickets(column.id).map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                id={column.id}
                title={column.title}
                tickets={getColumnTickets(column.id)}
                onRefine={setRefiningTicket}
                onDelete={(ticket) => deleteTicketMutation.mutate(ticket)}
                onTicketClick={setViewingTicket}
                onInspectTicket={onInspectTicket}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <div className="rotate-3 opacity-90">
              <TicketCard ticket={activeTicket} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TicketCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        selectedRepository={selectedRepo}
      />

      <RefinementModal
        isOpen={!!refiningTicket}
        onClose={() => setRefiningTicket(null)}
        task={refiningTicket}
      />

      <TicketDetailModal
        isOpen={!!viewingTicket}
        onClose={() => setViewingTicket(null)}
        ticket={viewingTicket}
        onDelete={(ticket) => deleteTicketMutation.mutate(ticket)}
        onInspect={(ticketId) => {
          setViewingTicket(null);
          onInspectTicket?.(ticketId);
        }}
      />
    </div>
  );
}
