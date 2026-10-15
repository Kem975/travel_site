import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, Container, Group, Pagination, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
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

  const [page, setPage] = useState(1);
  const visitors = useQuery({
    queryKey: ['admin', 'visitors', page],
    queryFn: () => adminApi.visitors(page),
    // Keep the previous page on screen while the next one loads, so the card does
    // not collapse to a skeleton and shove the pagination under the cursor.
    placeholderData: keepPreviousData,
  });

  // Rendered in the departure point's clock, not the reader's: these hours mean
  // "what time was it at home", and we are not reading them from home. The server
  // sends epoch seconds precisely so this choice is ours to make here.
  const tz = visitors.data?.timezone ?? undefined;
  const when = (seconds: number) =>
    new Date(seconds * 1000).toLocaleString(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    });

  // The zone spelled out once, so an hour on this page is never read as local.
  const tzLabel = tz
    ? new Intl.DateTimeFormat(i18n.language, { timeZone: tz, timeZoneName: 'long' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value
    : null;

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

      <Group mt="xl" mb="sm" justify="space-between" align="baseline">
        <Title order={3}>{t('admin.visitors.title')}</Title>
        {visitors.data && visitors.data.total > 0 && (
          <Text size="sm" c="dimmed">
            {t('admin.visitors.total', { count: visitors.data.total })}
          </Text>
        )}
      </Group>
      {tzLabel && (
        <Text size="xs" c="dimmed" mt={-6} mb="sm">
          {t('admin.visitors.timezoneNote', { zone: tzLabel })}
        </Text>
      )}
      <Card withBorder radius="md" padding="lg">
        {visitors.isLoading ? (
          <Skeleton h={20} />
        ) : visitors.data && visitors.data.visitors.length > 0 ? (
          <Stack gap="xs">
            {visitors.data.visitors.map((visitor, i) => (
              <Group key={`${visitor.visitor_name}-${visitor.created_ts}-${i}`} justify="space-between" wrap="nowrap">
                <Text fw={500}>{visitor.visitor_name}</Text>
                <Text size="sm" c="dimmed">
                  {when(visitor.last_used_ts ?? visitor.created_ts)}
                </Text>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            {t('admin.visitors.empty')}
          </Text>
        )}

        {/* One page is no choice to make, so no control. */}
        {visitors.data && visitors.data.pages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              total={visitors.data.pages}
              value={visitors.data.page}
              onChange={setPage}
              size="sm"
              withEdges
              getControlProps={(control) => ({ 'aria-label': t(`common.pagination.${control}`) })}
            />
          </Group>
        )}
      </Card>
    </Container>
  );
}
