import { useQuery } from '@tanstack/react-query';
import { Card, Container, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
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
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  const visitors = useQuery({ queryKey: ['admin', 'visitors'], queryFn: adminApi.visitors });

  // MySQL DATETIME ("Y-m-d H:i:s") isn't a format `new Date` parses portably.
  const when = (value: string) =>
    new Date(value.replace(' ', 'T')).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

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

      <Title order={3} mt="xl" mb="sm">
        {t('admin.visitors.title')}
      </Title>
      <Card withBorder radius="md" padding="lg">
        {visitors.isLoading ? (
          <Skeleton h={20} />
        ) : visitors.data && visitors.data.length > 0 ? (
          <Stack gap="xs">
            {visitors.data.map((visitor, i) => (
              <Group key={i} justify="space-between" wrap="nowrap">
                <Text fw={500}>{visitor.visitor_name}</Text>
                <Text size="sm" c="dimmed">
                  {visitor.last_used_at ? when(visitor.last_used_at) : when(visitor.created_at)}
                </Text>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            {t('admin.visitors.empty')}
          </Text>
        )}
      </Card>
    </Container>
  );
}
