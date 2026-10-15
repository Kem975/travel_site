import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Group,
  Image,
  Loader,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { mediaApi, type Photo } from '../../api/media';
import { PhotoUploader } from './PhotoUploader';

type BaseProps = {
  opened: boolean;
  onClose: () => void;
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

/**
 * Single pick closes on the first click; multiple collects a batch and hands it
 * over on confirm. A union rather than two callbacks, so a caller cannot ask for
 * a batch and then read it as one photo.
 */
type Props = BaseProps &
  ({ multiple?: false; onSelect: (photo: Photo) => void } | { multiple: true; onSelect: (photos: Photo[]) => void });

/** Reusable media-library picker (media library, cover photos, article blocks). */
export function MediaPicker(props: Props) {
  const { opened, onClose, destinationId, uploadTo } = props;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Photo[]>([]);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'photos', 'picker', destinationId ?? 'all'],
    queryFn: () => mediaApi.list(destinationId != null ? { destination_id: destinationId } : {}),
    enabled: opened,
  });

  // Reopening starts from nothing: the previous batch is already in the block,
  // and showing it still ticked would invite adding it a second time.
  useEffect(() => {
    if (opened) setSelected([]);
  }, [opened]);

  const isSelected = (id: number) => selected.some((p) => p.id === id);

  const toggle = (photo: Photo) =>
    setSelected((prev) => (prev.some((p) => p.id === photo.id) ? prev.filter((p) => p.id !== photo.id) : [...prev, photo]));

  // Selection order is insertion order, so the gallery receives the photos in
  // the order they were clicked rather than in library order.
  const pick = (photo: Photo) => {
    if (props.multiple) {
      toggle(photo);
      return;
    }
    props.onSelect(photo);
    onClose();
  };

  const confirm = () => {
    if (!props.multiple) return;
    props.onSelect(selected);
    onClose();
  };

  const onUploaded = (photo: Photo) => {
    void refetch();
    // Anything uploaded into this picker is what the user came for, so tick it:
    // dropping a batch of files and pressing confirm becomes the whole gesture.
    // Kept in state rather than read back from the grid, which may not have
    // refetched yet.
    if (props.multiple) setSelected((prev) => (prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={props.multiple ? t('media.picker.titleMultiple') : t('media.picker.title')}
      size="lg"
      centered
    >
      <Stack>
        <PhotoUploader destinationId={uploadTo ?? destinationId} onUploaded={onUploaded} />
        {isLoading ? (
          <Loader />
        ) : data && data.length > 0 ? (
          // Capped so the confirm bar stays on screen with a full library.
          <ScrollArea.Autosize mah={420} type="auto">
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {data.map((photo) => {
                const checked = isSelected(photo.id);
                return (
                  <UnstyledButton
                    key={photo.id}
                    onClick={() => pick(photo)}
                    aria-pressed={props.multiple ? checked : undefined}
                  >
                    <Box
                      style={{
                        position: 'relative',
                        borderRadius: 'var(--mantine-radius-sm)',
                        overflow: 'hidden',
                        // Inset outline rather than a border: the tile keeps its
                        // size when ticked, so the grid never reflows on a click.
                        outline: checked ? '3px solid var(--mantine-primary-color-filled)' : '3px solid transparent',
                        outlineOffset: -3,
                      }}
                    >
                      <Image
                        src={photo.thumb ?? undefined}
                        alt={photo.alt_text ?? ''}
                        h={110}
                        fit="cover"
                        style={{ opacity: checked ? 0.7 : 1 }}
                      />
                      {checked && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            background: 'var(--mantine-primary-color-filled)',
                            color: 'var(--mantine-color-white)',
                          }}
                        >
                          <IconCheck size={14} stroke={3} />
                        </Box>
                      )}
                    </Box>
                  </UnstyledButton>
                );
              })}
            </SimpleGrid>
          </ScrollArea.Autosize>
        ) : (
          <Text c="dimmed">{t('media.empty')}</Text>
        )}

        {props.multiple && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('media.picker.selectedCount', { count: selected.length })}
            </Text>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('admin.actions.cancel')}
              </Button>
              <Button onClick={confirm} disabled={selected.length === 0}>
                {t('media.picker.addSelected')}
              </Button>
            </Group>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
