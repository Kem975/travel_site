import { useQuery } from '@tanstack/react-query';
import { Box, Card, Center, Container, Group, Image, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateRange } from '../lib/date';
import { publicApi, type TripStats } from '../api/public';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Box ta="center">
      <Text fz={26} fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
    </Box>
  );
}

export function TripOverviewPage() {
  const { t, i18n } = useTranslation();
  const { tripSlug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'trip', tripSlug],
    queryFn: () => publicApi.trip(tripSlug as string),
    enabled: Boolean(tripSlug),
    retry: false,
  });

  if (isLoading) {
    return (
      <Center mih="50vh">
        <Loader />
      </Center>
    );
  }
  if (isError || !data) {
    return (
      <Container size="sm" py="xl">
        <Text c="dimmed">{t('trip.notFound')}</Text>
      </Container>
    );
  }

  const { trip, destinations, stats } = data;
  const dates = formatDateRange(trip.start_date, trip.end_date, i18n.language);
  const statEntries: [keyof TripStats, string | number][] = [
    ['destinations', stats.destinations],
    ['days', stats.days ?? '—'],
    ['photos', stats.photos],
  ];

  return (
    <Stack gap="xl">
      <Box style={{ position: 'relative', height: '42vh', minHeight: 260, overflow: 'hidden', background: '#0b1d2a' }}>
        {trip.cover && (
          <img src={trip.cover.full ?? undefined} srcSet={trip.cover.srcset} sizes="100vw" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <Box style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.05))' }} />
        <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, color: '#fff' }}>
          <Container size="lg" p={0}>
            <Title order={1} c="white">
              {trip.title}
            </Title>
            {dates && (
              <Text fz="sm" style={{ opacity: 0.85 }}>
                {dates}
              </Text>
            )}
          </Container>
        </Box>
      </Box>

      <Container size="lg" w="100%" pb="xl">
        <Stack gap="xl">
          {trip.description && <Text>{trip.description}</Text>}

          <Group justify="center" gap={48}>
            {statEntries.map(([key, value]) => (
              <Stat key={key} value={value} label={t(`trip.stats.${key}`)} />
            ))}
          </Group>

          <div>
            <Title order={3} mb="md">
              {t('trip.destinations')}
            </Title>
            <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
              {destinations.map((d) => (
                <Card key={d.id} component={Link} to={`/pays/${trip.slug}/${d.slug}`} withBorder radius="md" padding="0">
                  <Card.Section>
                    {d.cover ? (
                      <Image src={d.cover.thumb ?? undefined} alt="" h={150} fit="cover" />
                    ) : (
                      <Box h={150} style={{ background: 'var(--mantine-color-default-hover)' }} />
                    )}
                  </Card.Section>
                  <Group justify="space-between" p="sm" wrap="nowrap">
                    <Text fw={600}>{d.title}</Text>
                    {d.arrival_date && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(d.arrival_date, i18n.language)}
                      </Text>
                    )}
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </div>
        </Stack>
      </Container>
    </Stack>
  );
}
