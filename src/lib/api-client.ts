import { useAuthStore } from '@/stores/auth-store';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return useAuthStore.getState().token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) { useAuthStore.getState().logout(); throw new Error('Unauthorized'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: number; username: string; fullName: string; email: string; role: string; permissions: string[] } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () =>
    request<{ user: { id: number; username: string; fullName: string; email: string; role: string; permissions: string[] } }>('/api/auth/me'),
  getDashboard: () =>
    request<{ operationsToday: number; passwordResetsToday: number; disabledUsersToday: number; enabledUsersToday: number; activeAgents: number; recentActivity: any[] }>('/api/dashboard'),
  searchUsers: (query: string, field?: string) => {
    const sp = new URLSearchParams({ q: query });
    if (field) sp.set('field', field);
    return request<{ users: any[]; total: number }>(`/api/users/search?${sp.toString()}`);
  },
  getUser: (username: string) => request<any>(`/api/users/${username}`),
  resetPassword: (username: string, civilIdNumber?: string, civilIdExpiry?: string, password?: string) => request<{ success: boolean; message: string; newPassword?: string }>(`/api/users/${username}/reset-password`, { method: 'POST', body: JSON.stringify({ civilIdNumber, civilIdExpiry, password }) }),
  unlockAccount: (username: string, civilIdNumber?: string, civilIdExpiry?: string) => request<{ success: boolean; message: string }>(`/api/users/${username}/unlock`, { method: 'POST', body: JSON.stringify({ civilIdNumber, civilIdExpiry }) }),
  enableAccount: (username: string, civilIdNumber?: string, civilIdExpiry?: string) => request<{ success: boolean; message: string }>(`/api/users/${username}/enable`, { method: 'POST', body: JSON.stringify({ civilIdNumber, civilIdExpiry }) }),
  disableAccount: (username: string, civilIdNumber?: string, civilIdExpiry?: string) => request<{ success: boolean; message: string }>(`/api/users/${username}/disable`, { method: 'POST', body: JSON.stringify({ civilIdNumber, civilIdExpiry }) }),
  forcePasswordChange: (username: string, civilIdNumber?: string, civilIdExpiry?: string) => request<{ success: boolean; message: string; newPassword?: string }>(`/api/users/${username}/force-password-change`, { method: 'POST', body: JSON.stringify({ civilIdNumber, civilIdExpiry }) }),
  getAgents: () => request<any[]>('/api/agents'),
  createAgent: (data: { username: string; password: string; fullName: string; email: string; location?: string; phone?: string; roleId: number }) => request<any>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: number, data: any) => request<any>(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: number) => request<any>(`/api/agents/${id}`, { method: 'DELETE' }),
  resetAgentPassword: (id: number, password: string) => request<{ success: boolean; message: string }>(`/api/agents/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  getAuditLogs: (params?: { dateFrom?: string; dateTo?: string; agent?: string; action?: string; result?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.agent) sp.set('agent', params.agent);
    if (params?.action) sp.set('action', params.action);
    if (params?.result) sp.set('result', params.result);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    return request<{ logs: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/audit?${sp.toString()}`);
  },
  getAdStatus: () =>
    request<{ mode: string; configured: boolean; connected: boolean; error: string | null; lastCheck: number; config: any }>('/api/ad/status'),
  listOUs: () =>
    request<{ ous: { name: string; ou: string; dn: string }[]; domain: string }>('/api/ad/ous'),
  createAdUser: (data: {
    firstName: string;
    lastName: string;
    displayName: string;
    sAMAccountName: string;
    email: string;
    ou: string;
    department?: string;
    title?: string;
    description?: string;
    office?: string;
    phone?: string;
    employeeId?: string;
    password: string;
    mustChangePassword: boolean;
    enabled: boolean;
  }) => request<{ success: boolean; message: string; newPassword?: string }>('/api/ad/users', { method: 'POST', body: JSON.stringify(data) }),
  testAdConnection: () =>
    request<{ connected: boolean; error?: string; latencyMs?: number; serverInfo?: string }>('/api/ad/test', { method: 'POST' }),
  getVerifications: (username: string) => request<{ verifications: any[]; total: number }>(`/api/users/${username}/verifications`),
  exportAuditCSV: (params?: { dateFrom?: string; dateTo?: string; agent?: string; action?: string; result?: string }) => {
    const token = getToken();
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.agent) sp.set('agent', params.agent);
    if (params?.action) sp.set('action', params.action);
    if (params?.result) sp.set('result', params.result);
    return fetch(`/api/audit/export?${sp.toString()}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    }).then(res => { if (!res.ok) throw new Error('Export failed'); return res.blob(); });
  },
  exportCivilIdExcel: (username?: string) => {
    const token = getToken();
    const sp = new URLSearchParams();
    if (username) sp.set('username', username);
    return fetch(`/api/civil-id/export?${sp.toString()}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    }).then(res => { if (!res.ok) throw new Error('Export failed'); return res.blob(); });
  },
};
