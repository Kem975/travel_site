import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Image, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { mediaApi } from '../../api/media';
import { MediaPicker } from './MediaPicker';

type Props = { destinationId: number; initialCoverPhotoId: number | null };

// Cover is saved via its own endpoint (independent of the destination form).
export function CoverPhotoField({ destinationId, initialCoverPhotoId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [coverId, setCoverId] = useState<number | null>(initialCoverPhotoId);
  const [opened, { open, close }] = useDisclosure(false);

  const coverPhoto = useQuery({
    queryKey: ['admin', 'photo', coverId],
    queryFn: () => mediaApi.get(coverId as number),
    enabled: coverId != null,
  });

  const setCover = useMutation({
    mutationFn: (photoId: number | null) => adminApi.setDestinationCover(destinationId, photoId),
    onSuccess: (destination) => {
      setCoverId(destination.cover_photo_id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'destinations'] });
    },
  });

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {t('media.cover.label')}
      </Text>
      <Group>
        {coverId != null && coverPhoto.data ? (
          <Image src={coverPhoto.data.thumb ?? undefined} alt="" radius="sm" w={120} h={80} fit="cover" />
        ) : (
          <Text size="sm" c="dimmed">
            {t('media.cover.none')}
          </Text>
        )}
        <Button variant="default" size="xs" onClick={open}>
          {coverId != null ? t('media.cover.change') : t('media.cover.choose')}
        </Button>
        {coverId != null && (
          <Button variant="subtle" color="red" size="xs" loading={setCover.isPending} onClick={() => setCover.mutate(null)}>
            {t('media.cover.remove')}
          </Button>
        )}
      </Group>
      <MediaPicker
        opened={opened}
        onClose={close}
        destinationId={destinationId}
        onSelect={(photo) => setCover.mutate(photo.id)}
      />
    </Stack>
  );
}
