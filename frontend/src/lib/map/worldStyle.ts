import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import type { MapConfig } from './mapConfig';

// Bundled, ~100 KB world (Natural Earth 110m via world-atlas) → a clean stylized
// "marble". PMTiles street-level detail is unnecessary for the world view and is
// reserved for zoomed-in destination mini-maps in production.
const world = feature(
  countries110m as never,
  (countries110m as never as { objects: { countries: never } }).objects.countries,
) as unknown as FeatureCollection;

export type Scheme = 'light' | 'dark';

type Palette = {
  ocean: string;
  land: string;
  border: string;
  route: string;
  sky: string;
  horizon: string;
  fog: string;
  space: string; // page background behind the globe
};

const PALETTES: Record<Scheme, Palette> = {
  dark: { ocean: '#0b1f30', land: '#1d3b4b', border: '#2f5a6e', route: '#ffd27d', sky: '#0a1622', horizon: '#163047', fog: '#0a1622', space: '#05101a' },
  light: { ocean: '#b7d2e2', land: '#eef3f5', border: '#c4d3db', route: '#d9722e', sky: '#dceaf3', horizon: '#bcd6e6', fog: '#eef3f5', space: '#e6eef4' },
};

export function palette(scheme: Scheme): Palette {
  return PALETTES[scheme];
}

export function buildStyle(config: MapConfig, scheme: Scheme): StyleSpecification | string {
  if (config.styleUrl) {
    return config.styleUrl;
  }
  const p = PALETTES[scheme];

  const style: Record<string, unknown> = {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': p.sky,
      'horizon-color': p.horizon,
      'fog-color': p.fog,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.5,
      'fog-ground-blend': 0.2,
    },
    sources: {},
    layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': p.ocean } }],
  };

  const sources = style.sources as Record<string, unknown>;
  const layers = style.layers as Record<string, unknown>[];

  if (config.pmtilesUrl) {
    // Production path: self-hosted vector tiles, tuned once the file is on OVH.
    sources.basemap = { type: 'vector', url: `pmtiles://${config.pmtilesUrl}` };
  } else {
    sources.countries = { type: 'geojson', data: world };
    layers.push(
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': p.land, 'fill-opacity': 0.95 } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': p.border, 'line-width': 0.4 } },
    );
  }

  return style as unknown as StyleSpecification;
}

/** Recolor an existing map for a scheme change without rebuilding the style. */
export function applyPalette(map: MaplibreMap, scheme: Scheme): void {
  const p = PALETTES[scheme];
  if (map.getLayer('ocean')) map.setPaintProperty('ocean', 'background-color', p.ocean);
  if (map.getLayer('land')) map.setPaintProperty('land', 'fill-color', p.land);
  if (map.getLayer('borders')) map.setPaintProperty('borders', 'line-color', p.border);
  if (map.getLayer('route')) map.setPaintProperty('route', 'line-color', p.route);
  map.setSky({
    'sky-color': p.sky,
    'horizon-color': p.horizon,
    'fog-color': p.fog,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': 0.2,
  });
}
