import { useQuery } from '@tanstack/react-query';
import { Box, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicArticleApi } from '../api/article';
import { ApiError } from '../api/client';
import { ArticleRenderer } from '../components/article/ArticleRenderer';
import { CommentThread } from '../components/comments/CommentThread';

export function DestinationPage() {
  const { t } = useTranslation();
  const { tripSlug, destinationSlug } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'article', destinationSlug],
    queryFn: () => publicArticleApi.get(destinationSlug as string),
    enabled: Boolean(destinationSlug),
    retry: false,
  });

  if (isLoading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Container size="sm" py="xl">
        <Text c="dimmed">{notFound ? t('article.public.notFound') : t('article.public.error')}</Text>
      </Container>
    );
  }

  const cover = data.destination.cover;
  const dates = [data.destination.arrival_date, data.destination.departure_date].filter(Boolean).join(' → ');

  return (
    <Stack gap="xl">
      <Box style={{ position: 'relative', height: '52vh', minHeight: 300, overflow: 'hidden', background: '#0b1d2a' }}>
        {cover && (
          <img
            src={cover.full ?? undefined}
            srcSet={cover.srcset}
            sizes="100vw"
            alt={cover.alt_text ?? ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <Box style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.05))' }} />
        <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, color: '#fff' }}>
          <Container size="md" p={0}>
            {data.destination.country && (
              <Text tt="uppercase" fz="sm" style={{ opacity: 0.85 }}>
                {data.destination.country}
              </Text>
            )}
            <Title order={1} c="white">
              {data.article.title ?? data.destination.title}
            </Title>
            {data.article.subtitle && (
              <Text fz="lg" style={{ opacity: 0.9 }}>
                {data.article.subtitle}
              </Text>
            )}
            {dates && (
              <Text fz="sm" mt={4} style={{ opacity: 0.8 }}>
                {dates}
              </Text>
            )}
          </Container>
        </Box>
      </Box>

      <Container size="lg" pb="xl" w="100%">
        <ArticleRenderer blocks={data.blocks} photos={data.photos} />

        <Group justify="space-between" mt="xl" pt="xl" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          {data.prev ? (
            <Button component={Link} to={`/trips/${tripSlug}/${data.prev.slug}`} variant="subtle" leftSection={<IconArrowLeft size={16} />}>
              {data.prev.title}
            </Button>
          ) : (
            <span />
          )}
          {data.next ? (
            <Button component={Link} to={`/trips/${tripSlug}/${data.next.slug}`} variant="subtle" rightSection={<IconArrowRight size={16} />}>
              {data.next.title}
            </Button>
          ) : (
            <span />
          )}
        </Group>

        {destinationSlug && <CommentThread slug={destinationSlug} />}
      </Container>
    </Stack>
  );
}
