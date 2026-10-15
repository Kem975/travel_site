import { useQuery } from '@tanstack/react-query';
import { Box, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';
import { LazyGlobe } from '../components/globe/LazyGlobe';
import type { StylePreset } from '../lib/map/worldStyle';

const PRESETS: StylePreset[] = ['minimal', 'atlas', 'terrain'];
const DEFAULT_PRESET: StylePreset = 'terrain';

// The homepage IS the interactive globe (plan §6.1). Header nav (Journal /
// Gallery / About) stays persistent above it; the Journal is the accessible,
// non-globe path to the same content (plan §16.5).
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ['globe'], queryFn: publicApi.globe });

  // ?globe=terrain lets the globe styles be compared side by side without shipping a
  // control to visitors. Unknown values fall back to the default.
  const [params] = useSearchParams();
  const requested = params.get('globe') as StylePreset | null;
  const preset = requested && PRESETS.includes(requested) ? requested : DEFAULT_PRESET;

  const fallback = (
    <Center h="100%">
      <Loader />
    </Center>
  );

  return (
    <Box style={{ height: 'calc(100dvh - 92px)', minHeight: 420, borderRadius: 10, overflow: 'hidden' }}>
      {isLoading ? (
        fallback
      ) : isError ? (
        <Center h="100%">
          <Stack align="center" gap="sm">
            <Text c="dimmed">{t('common.loadError')}</Text>
            <Button component={Link} to="/journal" variant="light">
              {t('nav.journal')}
            </Button>
          </Stack>
        </Center>
      ) : (
        <LazyGlobe
          // Remount on preset change: the style is built once when the map is created.
          key={preset}
          trips={data?.trips ?? []}
          departure={data?.departure ?? null}
          latestDestinationId={data?.latest_destination_id ?? null}
          interactive
          stylePreset={preset}
          fallback={fallback}
          onOpen={(place) => navigate(`/pays/${place.trip_slug}/${place.slug}`, { viewTransition: true })}
        />
      )}
    </Box>
  );
}
