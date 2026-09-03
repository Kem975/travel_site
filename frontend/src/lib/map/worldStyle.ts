import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import countries50m from 'world-atlas/countries-50m.json';
import { splitAntimeridian, type Coord } from './greatCircle';
import type { MapConfig } from './mapConfig';

// Bundled, ~100 KB world (Natural Earth 110m via world-atlas) → a clean stylized
// "marble". PMTiles street-level detail is unnecessary for the world view and is
// reserved for zoomed-in destination mini-maps in production.
const world = feature(
  countries110m as never,
  (countries110m as never as { objects: { countries: never } }).objects.countries,
) as unknown as FeatureCollection;

// Higher-detail 50m world for the "atlas" preset. topojson mesh lets us separate
// the *coastline* (exterior arcs) from *internal* borders, so coasts read strong
// and country borders stay quiet — the classic printed-atlas hierarchy.
//
// Land is filled with the *per-country* polygons, NOT the dissolved `land` object:
// a single ocean-spanning MultiPolygon crosses the antimeridian and mis-tessellates
// on the globe (cream wedge + ring fans at the pole). Coast/border lines are also
// split at the antimeridian so no arc streaks across the sphere.
const atlasTopo = countries50m as never;
const atlasObjects = (countries50m as unknown as { objects: { countries: never } }).objects;

function splitMultiLine(mls: MultiLineString): Feature<MultiLineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: mls.coordinates.flatMap((line) => splitAntimeridian(line as Coord[])),
    },
  };
}

// --- Antimeridian polygon cutting -------------------------------------------
// Country polygons that straddle ±180° (USA's Aleutians, Russia's Chukotka,
// Fiji, Antarctica…) mis-tessellate on the globe into sweeping fill "wedges".
// We cut each crossing polygon into per-hemisphere pieces so every ring stays
// within one 360° band. Non-crossing polygons pass through untouched.
function ringCrosses(ring: number[][]): boolean {
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return true;
  }
  return false;
}

function unwrapLng(ring: number[][]): number[][] {
  let offset = 0;
  const out: number[][] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    const dl = ring[i][0] - ring[i - 1][0];
    if (dl > 180) offset -= 360;
    else if (dl < -180) offset += 360;
    out.push([ring[i][0] + offset, ring[i][1]]);
  }
  return out;
}

// Sutherland–Hodgman clip of a ring against the vertical line x = X.
function clipX(ring: number[][], x: number, keepLeft: boolean): number[][] {
  const out: number[][] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const ain = keepLeft ? a[0] <= x : a[0] >= x;
    const bin = keepLeft ? b[0] <= x : b[0] >= x;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// One polygon's rings → one or more single-ring polygons clipped into [-180,180].
function cutPolygon(rings: number[][][]): number[][][][] {
  if (!rings.some(ringCrosses)) return [rings];
  const polys: number[][][][] = [];
  for (const ring of rings) {
    const u = unwrapLng(ring);
    const xs = u.map((p) => p[0]);
    const minK = Math.floor((Math.min(...xs) + 180) / 360);
    const maxK = Math.floor((Math.max(...xs) + 180) / 360);
    for (let k = minK; k <= maxK; k++) {
      const piece = clipX(clipX(u, -180 + 360 * k, false), 180 + 360 * k, true);
      if (piece.length < 3) continue;
      const shifted = piece.map((p) => [p[0] - 360 * k, p[1]]);
      const a = shifted[0];
      const b = shifted[shifted.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) shifted.push([a[0], a[1]]); // close the ring
      // Drop degenerate or band-spanning slivers (e.g. Antarctica's pole-enclosing
      // remnant) so only valid, non-crossing rings reach MapLibre's tiler.
      if (shifted.length < 4 || ringCrosses(shifted)) continue;
      polys.push([shifted]);
    }
  }
  return polys;
}

function cutAntimeridian(fc: FeatureCollection): FeatureCollection {
  const features = fc.features.map((f) => {
    const g = f.geometry;
    let polys: number[][][][] | null = null;
    if (g.type === 'Polygon') polys = cutPolygon(g.coordinates as number[][][]);
    else if (g.type === 'MultiPolygon') {
      polys = [];
      for (const poly of g.coordinates as number[][][][]) polys.push(...cutPolygon(poly));
    }
    if (!polys) return f;
    return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } as MultiPolygon };
  });
  return { type: 'FeatureCollection', features };
}

// Built on first use, not at module load: cutting the 50m land polygons is the most
// expensive work in this file, and the minimal and terrain presets never need it.
function once<T>(build: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= build());
}

const atlasLand = once(() =>
  cutAntimeridian(feature(atlasTopo, atlasObjects.countries) as unknown as FeatureCollection),
);
const atlasCoast = once(() =>
  splitMultiLine(
    mesh(atlasTopo, atlasObjects.countries, (a: unknown, b: unknown) => a === b) as unknown as MultiLineString,
  ),
);
const atlasBorders = once(() =>
  splitMultiLine(
    mesh(atlasTopo, atlasObjects.countries, (a: unknown, b: unknown) => a !== b) as unknown as MultiLineString,
  ),
);

export type Scheme = 'light' | 'dark';
/** 'terrain' is the Natural Earth II raster: land cover, bathymetry and shaded relief. */
export type StylePreset = 'minimal' | 'atlas' | 'terrain';

export type Palette = {
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
  // Atlas-only (optional so the minimal palette stays lean):
  coastline?: string; // crisp coast line
  coastlineHalo?: string; // soft glow around land
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
    route: '#E08A00',
    label: '#2D3A32',
    labelHalo: 'rgba(251,247,239,0.88)',
    markerActive: '#E08A00',
    markerHalo: 'rgba(224,138,0,0.20)',
    markerStroke: '#FBF7EF',
    sky: '#E8DED0',
    horizon: '#C7D3CC',
    fog: '#F6EFE2',
    space: '#F2F4F6',
  }
};

// Premium "printed atlas": muted, higher contrast, pale-blue ocean, cream land,
// cognac route. Tuned to stay quiet so photos remain the colorful elements.
const ATLAS_PALETTES: Record<Scheme, Palette> = {
  dark: {
    ocean: '#0C2230',
    land: '#23454F',
    border: '#3B6370',
    route: '#F0B45E',
    label: '#F3EBDD',
    labelHalo: 'rgba(4,12,20,0.9)',
    markerActive: '#FFD27D',
    markerHalo: 'rgba(255,210,125,0.20)',
    markerStroke: '#0B1F31',
    sky: '#08131D',
    horizon: '#123247',
    fog: '#0A1622',
    space: '#05101A',
    coastline: '#7FB0BE',
    coastlineHalo: 'rgba(127,176,190,0.30)',
  },
  light: {
    ocean: '#A9C7D6',
    land: '#F1E7D0',
    border: '#D0BD9C',
    route: '#B96A3C',
    label: '#3A2E22',
    labelHalo: 'rgba(251,244,226,0.92)',
    markerActive: '#B96A3C',
    markerHalo: 'rgba(185,106,60,0.20)',
    markerStroke: '#FFF9EE',
    sky: '#DCEAF0',
    horizon: '#BBD3DF',
    fog: '#EAF0EC',
    space: '#F2F4F6',
    coastline: '#C0A982',
    coastlineHalo: 'rgba(251,244,226,0.85)',
  },
};

// Terrain preset: the raster supplies land and ocean, so these values only govern
// what sits *on* the texture (route, markers, labels) plus the surrounding sky.
// Blues are sampled from the raster itself so the atmosphere meets the ocean seamlessly.
const TERRAIN_PALETTES: Record<Scheme, Palette> = {
  dark: {
    ocean: '#2E4C61',
    land: '#4E6B57',
    border: 'rgba(255,255,255,0.28)',
    route: '#FFD27D',
    label: '#FFFFFF',
    labelHalo: 'rgba(0,0,0,0.8)',
    markerActive: '#FFD27D',
    markerHalo: 'rgba(255,210,125,0.22)',
    markerStroke: '#0B1F31',
    sky: '#08131D',
    horizon: '#25455C',
    fog: '#12283A',
    space: '#05101A',
  },
  light: {
    ocean: '#74A5C9',
    land: '#87B98F',
    border: 'rgba(45,40,30,0.32)',
    route: '#E08A00',
    label: '#22303A',
    labelHalo: 'rgba(255,255,255,0.92)',
    markerActive: '#E08A00',
    markerHalo: 'rgba(224,138,0,0.22)',
    markerStroke: '#FFFFFF',
    sky: '#C6DCEA',
    horizon: '#93B8D4',
    fog: '#DDEAF2',
    space: '#F2F4F6',
  },
};

export function palette(scheme: Scheme, preset: StylePreset = 'minimal'): Palette {
  if (preset === 'terrain') return TERRAIN_PALETTES[scheme];
  return (preset === 'atlas' ? ATLAS_PALETTES : PALETTES)[scheme];
}

function skySpec(p: Palette, preset: StylePreset) {
  const richer = preset !== 'minimal';
  return {
    'sky-color': p.sky,
    'horizon-color': p.horizon,
    'fog-color': p.fog,
    'sky-horizon-blend': richer ? 0.7 : 0.6,
    'horizon-fog-blend': richer ? 0.6 : 0.5,
    'fog-ground-blend': richer ? 0.3 : 0.2,
  };
}

export function buildStyle(
  config: MapConfig,
  scheme: Scheme,
  preset: StylePreset = 'minimal',
): StyleSpecification | string {
  if (config.styleUrl) {
    return config.styleUrl;
  }
  const p = palette(scheme, preset);

  const style: Record<string, unknown> = {
    version: 8,
    projection: { type: 'globe' },
    glyphs: config.glyphsUrl,
    sky: skySpec(p, preset),
    sources: {},
    layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': p.ocean } }],
  };

  const sources = style.sources as Record<string, unknown>;
  const layers = style.layers as Record<string, unknown>[];

  if (config.pmtilesUrl) {
    sources.basemap = { type: 'vector', url: `pmtiles://${config.pmtilesUrl}` };
  } else if (preset === 'terrain') {
    // Static Natural Earth texture: land cover, bathymetry and shaded relief are all
    // baked into the image, so no land/coastline geometry is needed — only borders.
    sources.terrain = {
      type: 'raster',
      tiles: [`${import.meta.env.BASE_URL}tiles/${preset}/{z}/{x}/{y}.webp`],
      tileSize: 512,
      minzoom: 0,
      maxzoom: 4,
      attribution: 'Natural Earth',
    };
    sources.borders = { type: 'geojson', data: atlasBorders() };
    layers.push(
      {
        id: 'terrain',
        type: 'raster',
        source: 'terrain',
        paint:
          scheme === 'dark'
            ? // The texture is daylight imagery; dim it so it sits in a night sky.
              { 'raster-brightness-max': 0.72, 'raster-saturation': -0.25, 'raster-contrast': 0.05 }
            : // Untouched, the raster reads washed out against a cool off-white.
              { 'raster-saturation': 0.14, 'raster-contrast': 0.06 },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'borders',
        paint: {
          'line-color': p.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 5, 1],
          'line-dasharray': [2, 1.5],
        },
      },
    );
  } else if (preset === 'atlas') {
    sources.land = { type: 'geojson', data: atlasLand() };
    sources.coastline = { type: 'geojson', data: atlasCoast() };
    sources.borders = { type: 'geojson', data: atlasBorders() };
    layers.push(
      // Soft halo bleeding off the coast (drawn under land so the blur sits in the ocean).
      {
        id: 'coastline-halo',
        type: 'line',
        source: 'coastline',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.coastlineHalo,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 4, 2.5],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 1, 1, 4, 2],
          'line-opacity': 0.4,
        },
      },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': p.land, 'fill-opacity': 1 } },
      {
        id: 'coastline',
        type: 'line',
        source: 'coastline',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.coastline, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 5, 1.4] },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'borders',
        paint: {
          'line-color': p.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 5, 0.9],
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.7,
        },
      },
    );
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
export function applyPalette(map: MaplibreMap, scheme: Scheme, preset: StylePreset = 'minimal'): void {
  const p = palette(scheme, preset);
  if (map.getLayer('ocean')) map.setPaintProperty('ocean', 'background-color', p.ocean);
  if (map.getLayer('terrain')) {
    const dark = scheme === 'dark';
    // Daylight gets a nudge of saturation rather than none: on the cool off-white
    // the untouched raster read as washed out. Night still pulls colour back so
    // the route and markers stay the brightest things on the sphere.
    map.setPaintProperty('terrain', 'raster-brightness-max', dark ? 0.72 : 1);
    map.setPaintProperty('terrain', 'raster-saturation', dark ? -0.25 : 0.14);
    map.setPaintProperty('terrain', 'raster-contrast', dark ? 0.05 : 0.06);
  }
  if (map.getLayer('coastline-halo')) map.setPaintProperty('coastline-halo', 'line-color', p.coastlineHalo!);
  if (map.getLayer('land')) map.setPaintProperty('land', 'fill-color', p.land);
  if (map.getLayer('coastline')) map.setPaintProperty('coastline', 'line-color', p.coastline!);
  if (map.getLayer('borders')) map.setPaintProperty('borders', 'line-color', p.border);
  if (map.getLayer('route-glow')) map.setPaintProperty('route-glow', 'line-color', p.route);
  if (map.getLayer('route')) map.setPaintProperty('route', 'line-color', p.route);
  if (map.getLayer('markers-glow')) map.setPaintProperty('markers-glow', 'circle-color', p.markerHalo);
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
  map.setSky(skySpec(p, preset));
}
