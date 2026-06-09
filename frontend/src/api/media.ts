import { api } from './client';

export const PHOTO_CATEGORIES = [
  'landscapes',
  'cities',
  'food',
  'wildlife',
  'portraits',
  'accommodation',
  'hiking',
] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export type Photo = {
  id: number;
  destination_id: number | null;
  trip_id: number | null;
  width: number;
  height: number;
  alt_text: string | null;
  caption: string | null;
  category: string | null;
  is_featured: boolean;
  original_filename: string | null;
  urls: Record<string, string>;
  srcset: string;
  thumb: string | null;
  full: string | null;
  created_at: string | null;
};

export type PhotoMetaInput = {
  alt_text?: string | null;
  caption?: string | null;
  category?: string | null;
  destination_id?: number | null;
  is_featured?: boolean;
};

export type PhotoFilter = { destination_id?: number; unassigned?: boolean; category?: string };

export type UploadFields = { destination_id?: number; caption?: string; category?: string; alt_text?: string };

export const mediaApi = {
  list: (filter: PhotoFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.destination_id != null) params.set('destination_id', String(filter.destination_id));
    if (filter.unassigned) params.set('unassigned', '1');
    if (filter.category) params.set('category', filter.category);
    const qs = params.toString();
    return api.get<{ photos: Photo[] }>(`/admin/photos${qs ? `?${qs}` : ''}`).then((r) => r.photos);
  },
  get: (id: number) => api.get<{ photo: Photo }>(`/admin/photos/${id}`).then((r) => r.photo),
  upload: (blob: Blob, filename: string, fields: UploadFields = {}) => {
    const form = new FormData();
    form.append('file', blob, filename);
    if (fields.destination_id != null) form.append('destination_id', String(fields.destination_id));
    if (fields.caption) form.append('caption', fields.caption);
    if (fields.category) form.append('category', fields.category);
    if (fields.alt_text) form.append('alt_text', fields.alt_text);
    return api.upload<{ photo: Photo }>('/admin/photos/upload', form).then((r) => r.photo);
  },
  update: (id: number, data: PhotoMetaInput) =>
    api.put<{ photo: Photo }>(`/admin/photos/${id}`, data).then((r) => r.photo),
  remove: (id: number) => api.del<{ deleted: boolean }>(`/admin/photos/${id}`),
};
