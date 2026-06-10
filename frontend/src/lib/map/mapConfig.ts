import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

// The basemap source is configuration, not baked into the globe component.
// Dev/PoC defaults to a self-contained bundled vector world; in production set
// pmtilesUrl (self-hosted PMTiles on OVH) or a full styleUrl. OVH range-request,
// file-size, caching and bandwidth behaviour still need real production testing.
export type MapConfig = {
  styleUrl?: string;
  pmtilesUrl?: string;
  attribution: string;
};

export const DEFAULT_MAP_CONFIG: MapConfig = {
  attribution: 'Natural Earth (public domain)',
};

let registered = false;
/** Register the pmtiles:// protocol once so a configured pmtilesUrl just works. */
export function registerPmtiles(): void {
  if (registered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  registered = true;
}
