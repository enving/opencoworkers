import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { KanbanBoard } from './components/KanbanBoard';
import { AgentActivityPanel } from './components/AgentActivityPanel';
import { PermissionModal } from './components/PermissionModal';
import { AgentLogViewer } from './components/AgentLogViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { SettingsView } from './components/SettingsView';
import { DaemonStatusBadge } from './components/DaemonStatusBadge';
import { SystemMetricsPanel } from './components/SystemMetricsPanel';
import { TicketList } from './components/TicketList';
import { ChatView } from './components/ChatView';
import { MemoriesView } from './components/MemoriesView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

interface PermissionRequest {
  id: string;
  action: string;
  description: string;
  filePaths?: string[];
  taskId?: string;
  sessionId?: string;
  timestamp: string;
}

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [inspectingTicketId, setInspectingTicketId] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('permission_requested', (event) => {
      try {
        const data = JSON.parse(event.data);
        setPermissionRequest(data.permission);
      } catch (err) {
        console.error('Failed to parse permission_requested event:', err);
      }
    });

    eventSource.addEventListener('permission_resolved', () => {
      setPermissionRequest(null);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Layout activeView={activeView} onViewChange={setActiveView}>
          <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 dark:text-zinc-100">OpenCoworkers</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Virtual Workforce Dashboard</p>
              </div>
              <div className="flex items-center gap-4">
                <DaemonStatusBadge />
                <ThemeToggle />
              </div>
            </header>


            {activeView === 'dashboard' ? (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="xl:col-span-3 space-y-6">
                  <KanbanBoard onInspectTicket={setInspectingTicketId} />
                  <AgentLogViewer />
                </div>
                <div className="space-y-6">
                  <AgentActivityPanel
                    inspectingTicketId={inspectingTicketId}
                    onCloseInspection={() => setInspectingTicketId(null)}
                  />
                  <SystemMetricsPanel />
                </div>
              </div>
            ) : activeView === 'chat' ? (
              <ChatView />
            ) : activeView === 'memories' ? (
              <MemoriesView />
            ) : activeView === 'tickets' ? (
              <TicketList />
            ) : activeView === 'settings' ? (
              <SettingsView />
            ) : (
              <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-zinc-800 border-dashed animate-in fade-in zoom-in-95 duration-500">
                <h2 className="text-xl font-bold text-zinc-100 mb-2 capitalize">{activeView}</h2>
                <p className="text-zinc-500">This view is currently under development.</p>
              </div>
            )}
          </div>
        </Layout>

        <PermissionModal
          request={permissionRequest}
          onClose={() => setPermissionRequest(null)}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
