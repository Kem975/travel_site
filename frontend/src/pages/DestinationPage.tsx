import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '../lib/date';
import { publicArticleApi, type ArticleLang } from '../api/article';
import { useUiLang } from '../lib/uiLang';
import { ApiError } from '../api/client';
import { ArticleRenderer } from '../components/article/ArticleRenderer';
import { CommentThread } from '../components/comments/CommentThread';

export function DestinationPage() {
  const { t, i18n } = useTranslation();
  const { tripSlug, destinationSlug } = useParams();

  // Normally the article follows the interface language. `override` is set only when
  // the reader accepts the original from the missing-translation notice, and is not
  // persisted: switching the interface language again should ask for that one.
  const [override, setOverride] = useState<ArticleLang | null>(null);
  const uiLang = useUiLang();
  const lang = override ?? uiLang;

  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'article', destinationSlug, lang],
    queryFn: () => publicArticleApi.get(destinationSlug as string, lang),
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
  const dates = formatDateRange(data.destination.arrival_date, data.destination.departure_date, i18n.language);

  return (
    <Stack gap="xl">
      <Box
        style={{
          position: 'relative',
          height: 'calc(100dvh - 60px)',
          minHeight: 460,
          overflow: 'hidden',
          background: 'var(--app-surface-muted)',
          // Full-bleed: cancel the AppShell main padding so the image reaches every edge.
          marginInline: 'calc(var(--app-shell-padding, 1rem) * -1)',
          marginTop: 'calc(var(--app-shell-padding, 1rem) * -1)',
        }}
      >
        {cover && (
          <img
            src={cover.full ?? undefined}
            srcSet={cover.srcset}
            sizes="100vw"
            alt={cover.alt_text ?? ''}
            className="vt-hero"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {/* Grounding gradient — deep at the base, gone by the upper third. */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(5,16,26,0.86) 0%, rgba(5,16,26,0.5) 20%, rgba(5,16,26,0.08) 46%, transparent 68%)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            color: '#fff',
            padding: 'clamp(1.75rem, 5.5vw, 5rem)',
          }}
        >
          <Box style={{ maxWidth: '54rem' }}>
            {data.destination.country && (
              <Text
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  opacity: 0.85,
                  marginBottom: '1rem',
                }}
              >
                {data.destination.country}
              </Text>
            )}
            <Title
              order={1}
              style={{
                color: '#fff',
                fontSize: 'clamp(2.7rem, 6.5vw, 5.25rem)',
                lineHeight: 1.02,
                textWrap: 'balance',
                margin: 0,
              }}
            >
              {data.article?.title ?? data.destination.title}
            </Title>
            {data.article?.subtitle && (
              <Text
                style={{
                  fontSize: 'clamp(1.05rem, 1.8vw, 1.4rem)',
                  lineHeight: 1.5,
                  opacity: 0.92,
                  maxWidth: '42rem',
                  marginTop: '1.1rem',
                }}
              >
                {data.article.subtitle}
              </Text>
            )}
            {dates && (
              <Text
                style={{
                  fontSize: '0.82rem',
                  letterSpacing: '0.03em',
                  opacity: 0.72,
                  marginTop: '1.5rem',
                }}
              >
                {dates}
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      <Container size="lg" pb="xl" w="100%">
        {data.article === null ? (
          <Container size="sm" px={0} py="xl">
            <Alert
              variant="light"
              title={t('article.public.missingTranslation.title', {
                language: t(`common.languages.${data.lang}`),
              })}
            >
              <Stack align="flex-start" gap="md">
                <Text size="sm">{t('article.public.missingTranslation.body')}</Text>
                <Button variant="light" onClick={() => setOverride(data.available_langs[0])}>
                  {t('article.public.missingTranslation.action', {
                    language: t(`common.languages.${data.available_langs[0]}`),
                  })}
                </Button>
              </Stack>
            </Alert>
          </Container>
        ) : (
          <ArticleRenderer blocks={data.blocks} photos={data.photos} />
        )}

        <Group justify="space-between" mt="xl" pt="xl" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          {data.prev ? (
            <Button component={Link} to={`/pays/${tripSlug}/${data.prev.slug}`} variant="subtle" leftSection={<IconArrowLeft size={16} />}>
              {data.prev.title}
            </Button>
          ) : (
            <span />
          )}
          {data.next ? (
            <Button component={Link} to={`/pays/${tripSlug}/${data.next.slug}`} variant="subtle" rightSection={<IconArrowRight size={16} />}>
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
