import { api } from './client';
import type { Destination, Trip } from './admin';

// Visitor-gated public reads (only published content; privacy filter applied server-side).
export const publicApi = {
  trips: () => api.get<{ trips: Trip[] }>('/trips').then((r) => r.trips),
  trip: (slug: string) => api.get<{ trip: Trip; destinations: Destination[] }>(`/trips/${slug}`),
};
