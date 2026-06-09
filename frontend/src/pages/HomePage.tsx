import { useQuery } from '@tanstack/react-query';
import { Box, Card, Image, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';

// Temporary landing (becomes the interactive globe in the next phase). For now,
// a trips grid that links into each trip overview.
export function HomePage() {
  const { t } = useTranslation();
  const { data: trips, isLoading } = useQuery({ queryKey: ['trips'], queryFn: publicApi.trips });

  return (
    <Stack maw={900} mx="auto" mt="xl" gap="lg">
      <div>
        <Title order={1}>{t('app.title')}</Title>
        <Text c="dimmed">{t('app.subtitle')}</Text>
      </div>

      {isLoading ? (
        <Loader />
      ) : trips && trips.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {trips.map((trip) => (
            <Card key={trip.id} component={Link} to={`/trips/${trip.slug}`} withBorder radius="md" padding="0">
              <Card.Section>
                {trip.cover ? (
                  <Image src={trip.cover.thumb ?? undefined} h={180} fit="cover" alt="" />
                ) : (
                  <Box h={180} style={{ background: 'var(--mantine-color-default-hover)' }} />
                )}
              </Card.Section>
              <Stack gap={4} p="md">
                <Title order={3}>{trip.title}</Title>
                {(trip.start_date || trip.end_date) && (
                  <Text size="sm" c="dimmed">
                    {[trip.start_date, trip.end_date].filter(Boolean).join(' → ')}
                  </Text>
                )}
                {trip.description && (
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {trip.description}
                  </Text>
                )}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed">{t('home.empty')}</Text>
      )}
    </Stack>
  );
}
