import type { Feature, MultiLineString } from 'geojson';

export type Coord = [number, number]; // [lng, lat]
export type RoutePoint = { lng: number | null; lat: number | null };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Densified great-circle arc between two points (slerp on the unit sphere).
 * A straight LineString looks wrong on a globe between distant points; this
 * hugs the surface.
 */
export function greatCircle(a: Coord, b: Coord, steps = 64): Coord[] {
  const lon1 = toRad(a[0]);
  const lat1 = toRad(a[1]);
  const lon2 = toRad(b[0]);
  const lat2 = toRad(b[1]);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (!Number.isFinite(d) || d === 0) {
    return [a, b];
  }

  const points: Coord[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return points;
}

/** Split a densified path wherever it crosses the antimeridian (lon jump > 180°). */
export function splitAntimeridian(points: Coord[]): Coord[][] {
  if (points.length === 0) {
    return [];
  }
  const segments: Coord[][] = [];
  let current: Coord[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i][0] - points[i - 1][0]) > 180) {
      segments.push(current);
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }
  segments.push(current);
  return segments;
}

/**
 * Route as a MultiLineString of great-circle arcs between consecutive points that
 * both have coordinates. Skips missing coords and degenerate (same-place) hops,
 * and splits at the date line so it never streaks across the map.
 */
export function routeFeature(points: RoutePoint[]): Feature<MultiLineString> {
  const coords = points
    .filter((p): p is { lng: number; lat: number } => p.lng != null && p.lat != null)
    .map((p) => [p.lng, p.lat] as Coord);

  const lines: Coord[][] = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    if (a[0] === b[0] && a[1] === b[1]) {
      continue; // repeated place — no segment
    }
    for (const segment of splitAntimeridian(greatCircle(a, b))) {
      if (segment.length >= 2) {
        lines.push(segment);
      }
    }
  }

  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } };
}
