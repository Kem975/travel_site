import { Box, Text } from '@mantine/core';
import { Globe } from '../components/globe/Globe';
import { TEST_DESTINATIONS } from '../lib/map/testDestinations';
import type { GlobeTrip } from '../api/public';

// Keeps the multi-continent demo (incl. the date-line hop) as a regression
// harness for the same Globe component the homepage uses.
const demoTrips: GlobeTrip[] = [
  {
    slug: 'demo',
    title: 'Demo',
    places: TEST_DESTINATIONS.map((d) => ({
      id: 0,
      slug: d.id,
      trip_slug: 'demo',
      title: d.title,
      country: d.country,
      lat: d.lat,
      lng: d.lng,
      status: d.status,
      arrival_date: d.arrival ?? null,
      departure_date: d.departure ?? null,
      has_article: false,
      cover_thumb: null,
    })),
  },
];

export function GlobePrototypePage() {
  return (
    <Box>
      <Text size="sm" c="dimmed" mb="xs">
        Globe prototype — premium “atlas” style on demo data across continents
        (Auckland→Honolulu crosses the date line). Toggle light/dark to compare.
      </Text>
      <Box style={{ height: 'calc(100dvh - 120px)', minHeight: 420, borderRadius: 10, overflow: 'hidden' }}>
        <Globe trips={demoTrips} interactive stylePreset="atlas" />
      </Box>
    </Box>
  );
}
