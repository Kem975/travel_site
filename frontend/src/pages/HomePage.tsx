import { useQuery } from '@tanstack/react-query';
import { Badge, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';

export function HomePage() {
  const { t } = useTranslation();
  const { data: trips, isLoading } = useQuery({ queryKey: ['trips'], queryFn: publicApi.trips });

  return (
    <Stack maw={760} mx="auto" mt="xl" gap="lg">
      <div>
        <Title order={1}>{t('app.title')}</Title>
        <Text c="dimmed">{t('app.subtitle')}</Text>
      </div>

      {isLoading ? (
        <Loader />
      ) : trips && trips.length > 0 ? (
        trips.map((trip) => (
          <Card key={trip.id} withBorder radius="md" padding="lg">
            <Group justify="space-between" wrap="nowrap">
              <Title order={3}>{trip.title}</Title>
              {(trip.start_date || trip.end_date) && (
                <Badge variant="light" style={{ flexShrink: 0 }}>
                  {(trip.start_date ?? '') + (trip.end_date ? ` → ${trip.end_date}` : '')}
                </Badge>
              )}
            </Group>
            {trip.description && (
              <Text c="dimmed" mt="xs">
                {trip.description}
              </Text>
            )}
          </Card>
        ))
      ) : (
        <Text c="dimmed">{t('home.empty')}</Text>
      )}
    </Stack>
  );
}
