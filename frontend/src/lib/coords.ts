/**
 * Decimal degrees in sexagesimal — 13°31′12″S.
 *
 * Latitude and longitude come back separately: stacked on two lines they read as
 * an instrument's position readout, which is the whole point of showing them.
 */

// Notation, not prose: only the east/west letter differs between the two
// languages the site speaks.
const WEST = { fr: 'O', en: 'W' } as const;

const pad = (n: number) => String(n).padStart(2, '0');

function dms(value: number, positive: string, negative: string): string {
  const total = Math.round(Math.abs(value) * 3600);
  // Carry the rounding up rather than printing 60″ or 60′.
  const degrees = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${degrees}°${pad(minutes)}′${pad(seconds)}″${value < 0 ? negative : positive}`;
}

export function formatCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
  lang: string,
): { lat: string; lng: string } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    lat: dms(lat, 'N', 'S'),
    lng: dms(lng, 'E', lang.startsWith('en') ? WEST.en : WEST.fr),
  };
}
