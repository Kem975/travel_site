import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Button, Container, Group, Loader, SegmentedControl, Title } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ArticleEditor } from '../../components/admin/article/ArticleEditor';
import type { ArticleLang } from '../../api/article';

const LANGS: ArticleLang[] = ['fr', 'en'];

export function ArticleEditorPage() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<ArticleLang>('fr');
  const { destinationId: param } = useParams();
  const destinationId = Number(param);
  const valid = Number.isFinite(destinationId);

  const destQuery = useQuery({
    queryKey: ['admin', 'destination', destinationId],
    queryFn: () => adminApi.getDestination(destinationId),
    enabled: valid,
  });
  const destination = destQuery.data;
  const tripQuery = useQuery({
    queryKey: ['admin', 'trip', destination?.trip_id],
    queryFn: () => adminApi.getTrip(destination!.trip_id),
    enabled: destination != null,
  });
  const trip = tripQuery.data;

  return (
    <Container size="md" py="md">
      <Group justify="space-between" mb="md" align="flex-end">
        <div>
          {destination && trip && (
            <Anchor component={Link} to={`/admin/pays/${destination.trip_id}`} size="sm">
              ← {trip.title}
            </Anchor>
          )}
          <Title order={2}>{destination ? t('article.editorTitle', { name: destination.title }) : '…'}</Title>
        </div>
        {destination && trip && (
          <Button
            component="a"
            href={`/pays/${trip.slug}/${destination.slug}`}
            target="_blank"
            variant="default"
            size="xs"
            leftSection={<IconExternalLink size={14} />}
          >
            {t('article.viewPublic')}
          </Button>
        )}
      </Group>
      <SegmentedControl
        mb="md"
        value={lang}
        onChange={(value) => setLang(value as ArticleLang)}
        data={LANGS.map((code) => ({ value: code, label: t(`common.langNames.${code}`) }))}
      />
      {/* key: a language switch is a different article, so remount rather than
          leak the previous one's blocks and version into the new editor. */}
      {valid ? <ArticleEditor key={lang} destinationId={destinationId} lang={lang} /> : <Loader />}
    </Container>
  );
}
