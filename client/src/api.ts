import { User } from './types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setAuth(token: string, user: User): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;
}

export function clearAuth(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('认证失败，请重新登录');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data as T;
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  me: () => request<User>('/auth/me')
};

// Stations
export const stationApi = {
  list: (search?: string, region?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (region) params.set('region', region);
    const qs = params.toString();
    return request<any[]>(`/stations${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => request<any>(`/stations/${id}`),
  create: (data: { name: string; location: string; region: string; lines: string }) =>
    request<any>('/stations', { method: 'POST', body: JSON.stringify(data) }),
  regions: () => request<string[]>('/stations/regions/list')
};

// Inspections
export const inspectionApi = {
  list: (status?: string, date?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    const qs = params.toString();
    return request<any[]>(`/inspections${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => request<any>(`/inspections/${id}`),
  start: (id: string) =>
    request<any>(`/inspections/${id}/start`, { method: 'POST' }),
  updateItem: (inspectionId: string, itemId: string, result: string, damage_desc: string) =>
    request<any>(`/inspections/${inspectionId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ result, damage_desc })
    }),
  submit: (id: string) =>
    request<{ message: string; repair_orders_created: number }>(`/inspections/${id}/submit`, {
      method: 'POST'
    })
};

// Repairs
export const repairApi = {
  list: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return request<any[]>(`/repairs${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => request<any>(`/repairs/${id}`),
  accept: (id: string) =>
    request<any>(`/repairs/${id}/accept`, { method: 'POST' }),
  complete: (id: string, photo: File | null, repair_desc: string) => {
    const formData = new FormData();
    if (photo) formData.append('photo', photo);
    formData.append('repair_desc', repair_desc);
    return request<any>(`/repairs/${id}/complete`, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type with boundary
    });
  }
};

// Stats
export const statsApi = {
  healthRanking: () => request<any[]>('/stats/health-ranking'),
  repairTimeliness: () => request<any>('/stats/repair-timeliness'),
  inspectionCompletion: () => request<any>('/stats/inspection-completion')
};
