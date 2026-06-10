import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Badge, Card, Container, Group, Image, Loader, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi, type JournalEntry } from '../api/public';

function monthKey(date: string | null): string {
  return date ? date.slice(0, 7) : 'undated';
}

export function JournalPage() {
  const { t, i18n } = useTranslation();
  const { data: entries, isLoading, isError } = useQuery({ queryKey: ['public', 'journal'], queryFn: publicApi.journal });

  const groups = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries ?? []) {
      const key = monthKey(entry.arrival_date);
      (map.get(key) ?? map.set(key, []).get(key)!).push(entry);
    }
    return [...map.entries()];
  }, [entries]);

  const monthLabel = (key: string) =>
    key === 'undated'
      ? t('journal.undated')
      : new Date(`${key}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <Container size="md" py="md">
      <Title order={2} mb="lg">
        {t('journal.title')}
      </Title>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Text c="dimmed">{t('common.loadError')}</Text>
      ) : groups.length === 0 ? (
        <Text c="dimmed">{t('journal.empty')}</Text>
      ) : (
        <Stack gap="xl">
          {groups.map(([key, items]) => (
            <div key={key}>
              <Text tt="uppercase" fw={700} c="dimmed" size="sm" mb="sm">
                {monthLabel(key)}
              </Text>
              <Stack>
                {items.map((entry) => (
                  <Card key={entry.id} withBorder radius="md" padding="0">
                    <Group gap={0} wrap="nowrap" align="stretch">
                      {entry.cover && (
                        <Image src={entry.cover.thumb ?? undefined} alt="" w={140} h={120} fit="cover" visibleFrom="xs" />
                      )}
                      <Stack gap={4} p="md" style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Title order={4}>{entry.title}</Title>
                          {entry.country && (
                            <Badge variant="light" size="sm">
                              {entry.country}
                            </Badge>
                          )}
                        </Group>
                        {entry.excerpt && (
                          <Text size="sm" c="dimmed" lineClamp={2}>
                            {entry.excerpt}
                          </Text>
                        )}
                        {entry.has_article && (
                          <Anchor component={Link} to={`/trips/${entry.trip_slug}/${entry.slug}`} size="sm" mt={2}>
                            {t('journal.read')} →
                          </Anchor>
                        )}
                      </Stack>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Container>
  );
}
