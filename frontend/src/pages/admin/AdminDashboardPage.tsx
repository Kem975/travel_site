import { useQuery } from '@tanstack/react-query';
import { Card, Container, SimpleGrid, Skeleton, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { adminApi, type Stats } from '../../api/admin';

const KEYS: (keyof Stats)[] = [
  'trips',
  'destinations',
  'published_articles',
  'draft_articles',
  'pending_comments',
  'photos',
];

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="lg">
        {t('auth.admin.dashboard')}
      </Title>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
        {KEYS.map((key) => (
          <Card key={key} withBorder radius="md" padding="lg">
            <Text size="xs" c="dimmed" tt="uppercase">
              {t(`admin.stats.${key}`)}
            </Text>
            {isLoading ? (
              <Skeleton h={34} mt={6} w={60} />
            ) : (
              <Text fz={30} fw={700}>
                {data?.[key] ?? 0}
              </Text>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}
