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
  label: string;
  labelHalo: string;
  markerActive: string; // selected-marker ring (route/gold accent)
  markerHalo: string; // selected-marker halo fill
  markerStroke: string; // base (status-colored) marker outline
  sky: string;
  horizon: string;
  fog: string;
  space: string; // page background behind the globe
};

const PALETTES: Record<Scheme, Palette> = {
  dark: {
    ocean: '#0b1f30',
    land: '#1d3b4b',
    border: '#2f5a6e',
    route: '#ffd27d',
    label: '#ffffff',
    labelHalo: 'rgba(0,0,0,0.85)',
    markerActive: '#ffd27d',
    markerHalo: 'rgba(255,210,125,0.18)',
    markerStroke: '#ffffff',
    sky: '#0a1622',
    horizon: '#163047',
    fog: '#0a1622',
    space: '#05101a',
  },
  light:{
    ocean: '#AFC7C8',
    land: '#EFE7D3',
    border: '#D8C8A8',
    route: '#B96A3C',
    label: '#2D3A32',
    labelHalo: 'rgba(251,247,239,0.88)',
    markerActive: '#B96A3C',
    markerHalo: 'rgba(185,106,60,0.18)',
    markerStroke: '#FBF7EF',
    sky: '#E8DED0',
    horizon: '#C7D3CC',
    fog: '#F6EFE2',
    space: '#FBF7EF',
  }
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
    glyphs: config.glyphsUrl,
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
  if (map.getLayer('markers-selected')) {
    map.setPaintProperty('markers-selected', 'circle-color', p.markerHalo);
    map.setPaintProperty('markers-selected', 'circle-stroke-color', p.markerActive);
  }
  if (map.getLayer('markers')) {
    map.setPaintProperty('markers', 'circle-stroke-color', p.markerStroke);
  }
  if (map.getLayer('marker-labels')) {
    map.setPaintProperty('marker-labels', 'text-color', p.label);
    map.setPaintProperty('marker-labels', 'text-halo-color', p.labelHalo);
  }
  map.setSky({
    'sky-color': p.sky,
    'horizon-color': p.horizon,
    'fog-color': p.fog,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': 0.2,
  });
}
