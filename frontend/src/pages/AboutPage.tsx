import { useQuery } from '@tanstack/react-query';
import { Anchor, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';

export function AboutPage() {
  const { t } = useTranslation();
  const { data: trips } = useQuery({ queryKey: ['trips'], queryFn: publicApi.trips });

  return (
    <Container size="sm" py="xl">
      <Title order={1} mb="md">
        {t('about.title')}
      </Title>
      <Text mb="lg">{t('app.subtitle')}</Text>
      <Text c="dimmed">{t('about.body')}</Text>

      {trips && trips.length > 0 && (
        <Stack mt="xl" gap="xs">
          <Title order={4}>{t('about.trips')}</Title>
          {trips.map((trip) => (
            <Anchor key={trip.id} component={Link} to={`/pays/${trip.slug}`}>
              {trip.title}
            </Anchor>
          ))}
        </Stack>
      )}
    </Container>
  );
}
