import { useQuery } from '@tanstack/react-query';
import { Box, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';
import { LazyGlobe } from '../components/globe/LazyGlobe';

// The homepage IS the interactive globe (plan §6.1). Header nav (Journal /
// Gallery / About) stays persistent above it; the Journal is the accessible,
// non-globe path to the same content (plan §16.5).
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: trips, isLoading, isError } = useQuery({ queryKey: ['globe'], queryFn: publicApi.globe });

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
          trips={trips ?? []}
          interactive
          fallback={fallback}
          onOpen={(place) => navigate(`/trips/${place.trip_slug}/${place.slug}`)}
        />
      )}
    </Box>
  );
}
