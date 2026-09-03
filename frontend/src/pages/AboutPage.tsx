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
      {/* app.subtitle is deliberately not repeated here: the second paragraph below
          says the same thing in the voice of the people writing it. */}
      <Stack gap="md">
        <Text fz="lg">{t('about.body.greeting')}</Text>
        <Text>{t('about.body.trip')}</Text>
        <Text>{t('about.body.blog')}</Text>
        <Text>{t('about.body.closing')}</Text>
      </Stack>

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
