import type { StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import type { MapConfig } from './mapConfig';

// Bundled, ~100 KB world (Natural Earth 110m via world-atlas) → a clean stylized
// "marble". PMTiles street-level detail is unnecessary for the world view and is
// reserved for zoomed-in destination mini-maps in production.
const world = feature(countries110m as never, (countries110m as never as { objects: { countries: never } }).objects.countries) as unknown as FeatureCollection;

const OCEAN = '#0b1f30';
const LAND = '#1d3b4b';
const BORDER = '#2f5a6e';
export const ROUTE_COLOR = '#ffd27d';

export function buildStyle(config: MapConfig): StyleSpecification | string {
  if (config.styleUrl) {
    return config.styleUrl;
  }

  const style: Record<string, unknown> = {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0a1622',
      'horizon-color': '#163047',
      'fog-color': '#0a1622',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.5,
      'fog-ground-blend': 0.2,
    },
    sources: {},
    layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': OCEAN } }],
  };

  const sources = style.sources as Record<string, unknown>;
  const layers = style.layers as Record<string, unknown>[];

  if (config.pmtilesUrl) {
    // Production path: self-hosted vector tiles. Layer styling for the PMTiles
    // schema is tuned in production once the basemap file is on OVH.
    sources.basemap = { type: 'vector', url: `pmtiles://${config.pmtilesUrl}` };
  } else {
    sources.countries = { type: 'geojson', data: world };
    layers.push(
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': LAND, 'fill-opacity': 0.95 } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': BORDER, 'line-width': 0.4 } },
    );
  }

  return style as unknown as StyleSpecification;
}
