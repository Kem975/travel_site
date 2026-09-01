import { api } from './client';

export type AuthScope = 'visitor' | 'admin';

export type SessionUser = {
  id: number;
  email: string;
  display_name: string;
  role: string;
};

export type Session = {
  authenticated: boolean;
  scope: AuthScope | null;
  user: SessionUser | null;
  /** Self-declared, asked for in a modal after the gate. Null until answered. */
  visitor_name: string | null;
  csrf_token: string | null;
};

export const getSession = () => api.get<Session>('/auth/session');
export const visitorLogin = (password: string) => api.post<Session>('/auth/login', { password });
export const adminLogin = (email: string, password: string) =>
  api.post<Session>('/auth/admin/login', { email, password });
export const setVisitorName = (name: string) =>
  api.post<{ visitor_name: string }>('/auth/name', { name });
export const logout = () => api.post<Session>('/auth/logout');
