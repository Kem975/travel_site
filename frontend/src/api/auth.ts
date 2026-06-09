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
  csrf_token: string | null;
};

export const getSession = () => api.get<Session>('/auth/session');
export const visitorLogin = (password: string) => api.post<Session>('/auth/login', { password });
export const adminLogin = (email: string, password: string) =>
  api.post<Session>('/auth/admin/login', { email, password });
export const logout = () => api.post<Session>('/auth/logout');
