import type { GlobePlace, GlobeTrip } from '../api/public';
import { pathLengthKm } from './map/greatCircle';
import { daysBetween, parseDate } from './date';

/**
 * The journey so far, read off the globe payload. Every figure here comes from real
 * trip data — the day count from the first arrival, the distance from the stops'
 * own coordinates — so the headline is never a number we made up.
 */
export type JourneyStats = {
  /** Days elapsed, the first arrival being day 1. Null before the journey starts. */
  day: number | null;
  /** Days still to wait, when the first arrival is in the future. */
  countdown: number | null;
  /** First stop of the route — what the distance is measured from. */
  origin: GlobePlace | null;
  /** Where we are now: the current stop, or the last one reached. */
  current: GlobePlace | null;
  /** Distance along the route from `origin` to `current`, in kilometres. */
  km: number | null;
  /** Which country of the route we're in, 1-based — the journey's leg number. */
  mission: number | null;
};

/** Index of the last place matching `status`, or -1. (`findLastIndex` is ES2023.) */
function lastIndexOfStatus(places: GlobePlace[], status: GlobePlace['status']): number {
  for (let i = places.length - 1; i >= 0; i--) {
    if (places[i].status === status) return i;
  }
  return -1;
}

const EMPTY: JourneyStats = {
  day: null,
  countdown: null,
  origin: null,
  current: null,
  km: null,
  mission: null,
};

/**
 * `trips` is in route order and so are the places inside them, which is what lets the
 * distance be a running total over a flat list. `today` is injectable for tests.
 */
export function journeyStats(trips: GlobeTrip[], today: Date = new Date()): JourneyStats {
  const places = trips.flatMap((trip) => trip.places);
  if (places.length === 0) return EMPTY;

  // The current stop is wherever we are now; before one is marked, the last stop
  // already visited stands in, so the counter still moves between updates.
  let currentIndex = lastIndexOfStatus(places, 'current');
  if (currentIndex === -1) currentIndex = lastIndexOfStatus(places, 'visited');

  // Earliest arrival rather than the first stop's: a missing date on stop 1 shouldn't
  // silently cost the whole day count.
  const start = places
    .map((place) => parseDate(place.arrival_date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const elapsed = start ? daysBetween(start, today) : null;
  const currentPlace = currentIndex === -1 ? null : places[currentIndex];
  const missionIndex = currentPlace ? trips.findIndex((trip) => trip.slug === currentPlace.trip_slug) : -1;

  return {
    day: elapsed !== null && elapsed >= 0 ? elapsed + 1 : null,
    countdown: elapsed !== null && elapsed < 0 ? -elapsed : null,
    origin: places[0],
    current: currentPlace,
    km: currentIndex <= 0 ? null : pathLengthKm(places.slice(0, currentIndex + 1)),
    mission: missionIndex === -1 ? null : missionIndex + 1,
  };
}
