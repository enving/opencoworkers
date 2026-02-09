import type { TicketsResponse, DaemonStatus, Ticket, ServerProfile, Skill, ApiIntegration, ApiIntegrationCreate } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      } else if (errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Ignore JSON parsing error for error response
    }
    const error = new Error(errorMessage) as any;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function fetchTickets(): Promise<Ticket[]> {
  try {
    // TEMPORARY: Try legacy endpoint FIRST to ensure stability while daemon is pending restart
    try {
      const data = await fetchJson<any>(`${API_BASE}/tasks`);
      return data.tasks as Ticket[];
    } catch (legacyErr: any) {
      // If legacy fails (e.g. daemon restarted and has new code), try new endpoint
      if (legacyErr.status === 404 || (legacyErr.message && legacyErr.message.includes('404'))) {
        console.warn('Legacy tasks endpoint not found, switching to tickets');
        const data = await fetchJson<TicketsResponse>(`${API_BASE}/tickets`);
        return data.tickets;
      }
      throw legacyErr;
    }
  } catch (err: any) {
    console.error('Fetch tickets failed:', err);
    throw err;
  }
}

export async function fetchTicket(id: string): Promise<Ticket> {
  try {
    // TEMPORARY: Try legacy endpoint FIRST
    try {
      const data = await fetchJson<any>(`${API_BASE}/tasks/${id}`);
      return data.task as Ticket;
    } catch (legacyErr: any) {
      if (legacyErr.status === 404 || (legacyErr.message && legacyErr.message.includes('404'))) {
        return await fetchJson<Ticket>(`${API_BASE}/tickets/${id}`);
      }
      throw legacyErr;
    }
  } catch (err: any) {
    throw err;
  }
}

export async function fetchStatus(): Promise<DaemonStatus> {
  return fetchJson<DaemonStatus>(`${API_BASE}/status`);
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  return fetchJson<Ticket>(`${API_BASE}/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteTicket(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tickets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}

export async function fetchServers(): Promise<ServerProfile[]> {
  const data = await fetchJson<{ servers: ServerProfile[] }>(`${API_BASE}/servers`);
  return data.servers;
}

export async function addServer(server: Omit<ServerProfile, 'id' | 'status'>): Promise<ServerProfile> {
  return fetchJson<ServerProfile>(`${API_BASE}/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
}

export async function updateServer(id: string, updates: Partial<ServerProfile>): Promise<ServerProfile> {
  return fetchJson<ServerProfile>(`${API_BASE}/servers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteServer(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/servers/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}

export async function pingServer(id: string): Promise<ServerProfile> {
  return fetchJson<ServerProfile>(`${API_BASE}/servers/${id}/ping`, {
    method: 'POST',
  });
}

export async function fetchSkills(): Promise<Skill[]> {
  const data = await fetchJson<{ skills: Skill[] }>(`${API_BASE}/skills`);
  return data.skills;
}

export async function fetchOpenCodeConfig(): Promise<any> {
  const data = await fetchJson<{ config: any }>(`${API_BASE}/opencode/config`);
  return data.config;
}

export async function updateOpenCodeConfig(config: any): Promise<any> {
  return fetchJson<any>(`${API_BASE}/opencode/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

// Refinement Loop (Ralph Wiggum Loop) API
export async function fetchRefinementLoopEnabled(): Promise<boolean> {
  const data = await fetchJson<{ enabled: boolean }>(`${API_BASE}/settings/refinement-loop`);
  return data.enabled;
}

export async function setRefinementLoopEnabled(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
  return fetchJson<{ success: boolean; enabled: boolean }>(`${API_BASE}/settings/refinement-loop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export async function triggerTicketRefinement(ticketId: string, feedback?: string): Promise<{
  success: boolean;
  ticketId: string;
  message: string;
  newSessionId?: string
}> {
  return fetchJson<{ success: boolean; ticketId: string; message: string; newSessionId?: string }>(
    `${API_BASE}/tickets/${ticketId}/refine`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }
  );
}

// API Integrations CRUD (TASK-178 - Generic API Connector)
export async function fetchIntegrations(): Promise<ApiIntegration[]> {
  const data = await fetchJson<{ integrations: ApiIntegration[] }>(`${API_BASE}/integrations`);
  return data.integrations;
}

export async function addIntegration(integration: ApiIntegrationCreate): Promise<ApiIntegration> {
  return fetchJson<ApiIntegration>(`${API_BASE}/integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(integration),
  });
}

export async function updateIntegration(id: string, updates: Partial<ApiIntegrationCreate>): Promise<ApiIntegration> {
  return fetchJson<ApiIntegration>(`${API_BASE}/integrations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteIntegration(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/integrations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}

export async function testIntegration(id: string): Promise<{ success: boolean; status?: number; error?: string }> {
  return fetchJson<{ success: boolean; status?: number; error?: string }>(`${API_BASE}/integrations/${id}/test`, {
    method: 'POST',
  });
}
