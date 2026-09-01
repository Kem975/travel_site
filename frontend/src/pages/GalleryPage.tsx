import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Group, Image, Loader, Select, SimpleGrid, Text, Title, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/public';
import { Lightbox } from '../components/gallery/Lightbox';

export function GalleryPage() {
  const { t } = useTranslation();
  const [trip, setTrip] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'gallery', trip, category],
    queryFn: () => publicApi.gallery({ trip: trip ?? undefined, category: category ?? undefined }),
  });
  const photos = data?.photos ?? [];

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        {t('gallery.title')}
      </Title>

      <Group mb="lg" gap="sm">
        <Select
          placeholder={t('gallery.allTrips')}
          clearable
          data={(data?.filters.trips ?? []).map((x) => ({ value: x.slug, label: x.title }))}
          value={trip}
          onChange={setTrip}
          w={200}
        />
        <Select
          placeholder={t('gallery.allCategories')}
          clearable
          data={(data?.filters.categories ?? []).map((c) => ({ value: c, label: t(`media.categories.${c}`) }))}
          value={category}
          onChange={setCategory}
          w={180}
        />
      </Group>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Text c="dimmed">{t('common.loadError')}</Text>
      ) : photos.length > 0 ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
          {photos.map((photo, i) => (
            <UnstyledButton key={photo.id} aria-label={photo.caption ?? photo.alt_text ?? t('gallery.viewPhoto')} onClick={() => setLightbox(i)}>
              <Image src={photo.urls['480'] ?? photo.thumb ?? undefined} alt={photo.alt_text ?? ''} h={180} fit="cover" radius="sm" />
            </UnstyledButton>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed">{t('gallery.empty')}</Text>
      )}

      <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </Container>
  );
}
