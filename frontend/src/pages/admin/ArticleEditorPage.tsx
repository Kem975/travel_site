import { useQuery } from '@tanstack/react-query';
import { Anchor, Button, Container, Group, Loader, Title } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ArticleEditor } from '../../components/admin/article/ArticleEditor';

export function ArticleEditorPage() {
  const { t } = useTranslation();
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
            <Anchor component={Link} to={`/admin/trips/${destination.trip_id}`} size="sm">
              ← {trip.title}
            </Anchor>
          )}
          <Title order={2}>{destination ? t('article.editorTitle', { name: destination.title }) : '…'}</Title>
        </div>
        {destination && trip && (
          <Button
            component="a"
            href={`/trips/${trip.slug}/${destination.slug}`}
            target="_blank"
            variant="default"
            size="xs"
            leftSection={<IconExternalLink size={14} />}
          >
            {t('article.viewPublic')}
          </Button>
        )}
      </Group>
      {valid ? <ArticleEditor destinationId={destinationId} /> : <Loader />}
    </Container>
  );
}
