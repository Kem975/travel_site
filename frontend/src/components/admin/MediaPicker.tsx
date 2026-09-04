import { useQuery } from '@tanstack/react-query';
import { Image, Loader, Modal, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { mediaApi, type Photo } from '../../api/media';
import { PhotoUploader } from './PhotoUploader';

type Props = {
  opened: boolean;
  onClose: () => void;
  onSelect: (photo: Photo) => void;
  /** Narrows the list to one stop's photos. */
  destinationId?: number;
  /**
   * Stop that newly uploaded photos are attached to, without narrowing the list.
   * The article editor needs exactly this: pick from the whole library, but file
   * anything uploaded here under the stop being written about — otherwise the
   * photo stays unassigned and never reaches the public gallery.
   */
  uploadTo?: number;
};

/** Reusable media-library picker (also used later for article image/gallery blocks). */
export function MediaPicker({ opened, onClose, onSelect, destinationId, uploadTo }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'photos', 'picker', destinationId ?? 'all'],
    queryFn: () => mediaApi.list(destinationId != null ? { destination_id: destinationId } : {}),
    enabled: opened,
  });

  return (
    <Modal opened={opened} onClose={onClose} title={t('media.picker.title')} size="lg" centered>
      <Stack>
        <PhotoUploader destinationId={uploadTo ?? destinationId} onUploaded={() => void refetch()} />
        {isLoading ? (
          <Loader />
        ) : data && data.length > 0 ? (
          <SimpleGrid cols={{ base: 2, sm: 3 }}>
            {data.map((photo) => (
              <UnstyledButton
                key={photo.id}
                onClick={() => {
                  onSelect(photo);
                  onClose();
                }}
              >
                <Image src={photo.thumb ?? undefined} alt={photo.alt_text ?? ''} radius="sm" h={110} fit="cover" />
              </UnstyledButton>
            ))}
          </SimpleGrid>
        ) : (
          <Text c="dimmed">{t('media.empty')}</Text>
        )}
      </Stack>
    </Modal>
  );
}
