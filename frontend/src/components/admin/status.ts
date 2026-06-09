import type { DestinationStatus, TripStatus, Visibility } from '../../api/admin';

export const TRIP_STATUSES: TripStatus[] = ['draft', 'published', 'archived'];
export const VISIBILITIES: Visibility[] = ['private', 'password_protected', 'public'];
export const DESTINATION_STATUSES: DestinationStatus[] = ['planned', 'visited', 'current', 'cancelled', 'hidden'];

const tripColors: Record<TripStatus, string> = { draft: 'gray', published: 'teal', archived: 'dark' };
const destColors: Record<DestinationStatus, string> = {
  planned: 'gray',
  visited: 'teal',
  current: 'blue',
  cancelled: 'red',
  hidden: 'dark',
};

export const tripStatusColor = (status: TripStatus): string => tripColors[status];
export const destStatusColor = (status: DestinationStatus): string => destColors[status];
