import { api } from './client';

export type TripStatus = 'draft' | 'published' | 'archived';
export type Visibility = 'private' | 'password_protected' | 'public';
export type DestinationStatus = 'planned' | 'visited' | 'current' | 'cancelled' | 'hidden';

export type Trip = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_photo_id: number | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  visibility: Visibility;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Destination = {
  id: number;
  trip_id: number;
  title: string;
  slug: string;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  excerpt: string | null;
  cover_photo_id: number | null;
  status: DestinationStatus;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Stats = {
  trips: number;
  destinations: number;
  published_articles: number;
  draft_articles: number;
  pending_comments: number;
  photos: number;
};

export type TripInput = {
  title: string;
  slug?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: TripStatus;
  visibility: Visibility;
};

export type DestinationInput = {
  title: string;
  slug?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  arrival_date?: string;
  departure_date?: string;
  excerpt?: string;
  status: DestinationStatus;
};

export type GeoResult = { label: string; lat: number; lng: number; country: string };

export type Visitor = { visitor_name: string; created_at: string; last_used_at: string | null };

export const adminApi = {
  stats: () => api.get<{ stats: Stats }>('/admin/stats').then((r) => r.stats),

  visitors: () => api.get<{ visitors: Visitor[] }>('/admin/visitors').then((r) => r.visitors),

  geocode: (q: string) =>
    api.get<{ results: GeoResult[] }>(`/admin/geocode?q=${encodeURIComponent(q)}`).then((r) => r.results),

  getDestination: (id: number) =>
    api.get<{ destination: Destination }>(`/admin/destinations/${id}`).then((r) => r.destination),

  listTrips: () => api.get<{ trips: Trip[] }>('/admin/trips').then((r) => r.trips),
  getTrip: (id: number) => api.get<{ trip: Trip }>(`/admin/trips/${id}`).then((r) => r.trip),
  createTrip: (data: TripInput) => api.post<{ trip: Trip }>('/admin/trips', data).then((r) => r.trip),
  updateTrip: (id: number, data: TripInput) =>
    api.put<{ trip: Trip }>(`/admin/trips/${id}`, data).then((r) => r.trip),
  deleteTrip: (id: number) => api.del<{ deleted: boolean }>(`/admin/trips/${id}`),
  reorderTrips: (orderedIds: number[]) =>
    api.post<{ trips: Trip[] }>('/admin/trips/reorder', { ordered_ids: orderedIds }).then((r) => r.trips),

  listDestinations: (tripId: number) =>
    api.get<{ destinations: Destination[] }>(`/admin/trips/${tripId}/destinations`).then((r) => r.destinations),
  createDestination: (tripId: number, data: DestinationInput) =>
    api.post<{ destination: Destination }>('/admin/destinations', { trip_id: tripId, ...data }).then((r) => r.destination),
  updateDestination: (id: number, data: DestinationInput) =>
    api.put<{ destination: Destination }>(`/admin/destinations/${id}`, data).then((r) => r.destination),
  deleteDestination: (id: number) => api.del<{ deleted: boolean }>(`/admin/destinations/${id}`),
  reorderDestinations: (tripId: number, orderedIds: number[]) =>
    api
      .post<{ destinations: Destination[] }>('/admin/destinations/reorder', {
        trip_id: tripId,
        ordered_ids: orderedIds,
      })
      .then((r) => r.destinations),

  setTripCover: (id: number, photoId: number | null) =>
    api.put<{ trip: Trip }>(`/admin/trips/${id}/cover`, { photo_id: photoId }).then((r) => r.trip),
  setDestinationCover: (id: number, photoId: number | null) =>
    api.put<{ destination: Destination }>(`/admin/destinations/${id}/cover`, { photo_id: photoId }).then((r) => r.destination),
};
