import { api } from './client';
import type { Destination, Trip } from './admin';
import type { Photo } from './media';

export type WithCover<T> = T & { cover: Photo | null };

export type JournalEntry = {
  id: number;
  slug: string;
  trip_slug: string;
  trip_title: string;
  title: string;
  country: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  excerpt: string | null;
  status: string;
  cover: Photo | null;
  has_article: boolean;
};

export type TripStats = { countries: number; destinations: number; days: number | null; photos: number };

export type TripOverview = {
  trip: WithCover<Trip>;
  destinations: WithCover<Destination>[];
  stats: TripStats;
};

export type GalleryFilterOptions = {
  trips: { slug: string; title: string }[];
  countries: string[];
  categories: string[];
};
export type GalleryData = { photos: Photo[]; filters: GalleryFilterOptions };
export type GalleryQuery = { trip?: string; country?: string; destination?: string; category?: string };

export type GlobeStatusName = 'planned' | 'visited' | 'current' | 'cancelled' | 'hidden';
export type GlobePlace = {
  id: number;
  slug: string;
  trip_slug: string;
  title: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  status: GlobeStatusName;
  has_article: boolean;
  cover_thumb: string | null;
};
export type GlobeTrip = { slug: string; title: string; places: GlobePlace[] };

export const publicApi = {
  trips: () => api.get<{ trips: WithCover<Trip>[] }>('/trips').then((r) => r.trips),
  globe: () => api.get<{ trips: GlobeTrip[] }>('/globe').then((r) => r.trips),
  trip: (slug: string) => api.get<TripOverview>(`/trips/${slug}`),
  journal: () => api.get<{ entries: JournalEntry[] }>('/journal').then((r) => r.entries),
  gallery: (query: GalleryQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return api.get<GalleryData>(`/gallery${qs ? `?${qs}` : ''}`);
  },
};
