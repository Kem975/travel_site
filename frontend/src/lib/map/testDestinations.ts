export type GlobeStatus = 'visited' | 'current' | 'planned';

export type GlobeDestination = {
  id: string;
  title: string;
  country: string;
  lng: number | null;
  lat: number | null;
  status: GlobeStatus;
  color: string;
  /** Reached stops carry dates so the harness exercises the journey HUD too. */
  arrival?: string;
  departure?: string;
};

// Lima & Cusco are the real data; the rest are temporary points spread across
// continents to expose real globe + route behaviour — including an
// Auckland → Honolulu hop across the international date line, and one entry with
// missing coordinates to confirm graceful handling.
export const TEST_DESTINATIONS: GlobeDestination[] = [
  { id: 'lima', title: 'Lima', country: 'Peru', lng: -77.0428, lat: -12.0464, status: 'visited', color: '#e8a87c', arrival: '2026-06-15', departure: '2026-06-21' },
  { id: 'cusco', title: 'Cusco', country: 'Peru', lng: -71.9675, lat: -13.5319, status: 'visited', color: '#c38d9e', arrival: '2026-06-22', departure: '2026-07-04' },
  { id: 'rio', title: 'Rio de Janeiro', country: 'Brazil', lng: -43.1729, lat: -22.9068, status: 'visited', color: '#85cdca', arrival: '2026-07-05', departure: '2026-07-19' },
  { id: 'cape-town', title: 'Cape Town', country: 'South Africa', lng: 18.4241, lat: -33.9249, status: 'visited', color: '#e27d60', arrival: '2026-07-20', departure: '2026-08-09' },
  { id: 'kathmandu', title: 'Kathmandu', country: 'Nepal', lng: 85.324, lat: 27.7172, status: 'current', color: '#41b3a3', arrival: '2026-08-10' },
  { id: 'tokyo', title: 'Tokyo', country: 'Japan', lng: 139.6917, lat: 35.6895, status: 'planned', color: '#c8cdd6' },
  { id: 'auckland', title: 'Auckland', country: 'New Zealand', lng: 174.7633, lat: -36.8485, status: 'planned', color: '#c8cdd6' },
  { id: 'honolulu', title: 'Honolulu', country: 'USA', lng: -157.8583, lat: 21.3069, status: 'planned', color: '#c8cdd6' },
  { id: 'reykjavik', title: 'Reykjavik', country: 'Iceland', lng: -21.9426, lat: 64.1466, status: 'planned', color: '#c8cdd6' },
  { id: 'mystery', title: 'Undisclosed', country: '', lng: null, lat: null, status: 'planned', color: '#777' },
];
