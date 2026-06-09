import { api } from './client';

export type PublicComment = {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
  replies: PublicComment[];
};

export type CommentThreadData = {
  comments_enabled: boolean;
  comments: PublicComment[];
  form_token: string;
};

export type NewComment = {
  author_name: string;
  author_email?: string;
  body: string;
  parent_id?: number;
  website: string; // honeypot — must stay empty
  form_token: string;
};

export const publicCommentApi = {
  list: (slug: string) => api.get<CommentThreadData>(`/destinations/${slug}/comments`),
  post: (slug: string, data: NewComment) =>
    api.post<{ ok: boolean; status: 'pending' | 'published' }>(`/destinations/${slug}/comments`, data),
};

export type CommentStatus = 'pending' | 'published' | 'rejected' | 'spam';

export type AdminComment = {
  id: number;
  destination_id: number;
  destination_title: string;
  destination_slug: string;
  parent_id: number | null;
  author_name: string;
  author_email: string | null;
  body: string;
  status: CommentStatus;
  created_at: string;
};

export const adminCommentApi = {
  list: (status?: CommentStatus) =>
    api.get<{ comments: AdminComment[] }>(`/admin/comments${status ? `?status=${status}` : ''}`).then((r) => r.comments),
  setStatus: (id: number, status: CommentStatus) =>
    api.put<{ comment: AdminComment }>(`/admin/comments/${id}`, { status }).then((r) => r.comment),
  reply: (id: number, body: string) =>
    api.post<{ comment: AdminComment }>(`/admin/comments/${id}/reply`, { body }).then((r) => r.comment),
  remove: (id: number) => api.del<{ deleted: boolean }>(`/admin/comments/${id}`),
};
