import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Ticket } from '../types';
import { RotateCcw } from 'lucide-react';
import { triggerTicketRefinement } from '../api/client';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Ticket | null;
}

export function RefinementModal({ isOpen, onClose, task }: RefinementModalProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState('');

  const refinementMutation = useMutation({
    mutationFn: ({ ticketId, feedback }: { ticketId: string; feedback: string }) =>
      triggerTicketRefinement(ticketId, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setFeedback('');
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!task || !feedback.trim()) {
      return;
    }

    refinementMutation.mutate({
      ticketId: task.id,
      feedback: feedback.trim(),
    });
  };

  const handleCancel = () => {
    setFeedback('');
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="text-amber-500" size={20} />
          <h2 className="text-xl font-bold text-zinc-100">Refine Ticket</h2>
        </div>

        <p className="text-sm text-zinc-400 mb-4">
          Sending <span className="text-zinc-200 font-mono">{task.id}</span> back to the agent for refinement.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="feedback" className="block text-sm font-medium text-zinc-300 mb-1">
              Refinement Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              placeholder="Describe what needs to be improved..."
              rows={4}
              required
              autoFocus
            />
          </div>

          {refinementMutation.isError && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-2">
              {refinementMutation.error instanceof Error
                ? refinementMutation.error.message
                : 'Failed to trigger refinement'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-750 hover:border-zinc-600 transition-colors"
              disabled={refinementMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!feedback.trim() || refinementMutation.isPending}
            >
              {refinementMutation.isPending ? 'Triggering Refinement...' : 'Submit Refinement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
