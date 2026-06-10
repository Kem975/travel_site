import { useState } from 'react';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { ActionIcon, Group, Loader, Stack, Text } from '@mantine/core';
import { IconPhoto, IconRefresh, IconUpload, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { mediaApi, type Photo } from '../../api/media';
import { compressImage } from '../../utils/compressImage';

type QueueItem = { id: string; name: string; status: 'queued' | 'working' | 'done' | 'error' };

type Props = { destinationId?: number; onUploaded?: (photo: Photo) => void };

/** Drag-and-drop uploader: client-side compression → upload, sequential, with per-file retry. */
export function PhotoUploader({ destinationId, onUploaded }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});

  const patch = (id: string, next: Partial<QueueItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  const process = async (id: string, file: File) => {
    patch(id, { status: 'working' });
    try {
      const { blob, filename } = await compressImage(file);
      const photo = await mediaApi.upload(blob, filename, { destination_id: destinationId });
      patch(id, { status: 'done' });
      onUploaded?.(photo);
    } catch {
      patch(id, { status: 'error' });
    }
  };

  const onDrop = (dropped: File[]) => {
    const queued = dropped.map((file) => ({ item: { id: crypto.randomUUID(), name: file.name, status: 'queued' as const }, file }));
    setItems((prev) => [...prev, ...queued.map((q) => q.item)]);
    setFiles((prev) => ({ ...prev, ...Object.fromEntries(queued.map((q) => [q.item.id, q.file])) }));
    // Upload one at a time to stay gentle on weak connections.
    void queued.reduce((chain, q) => chain.then(() => process(q.item.id, q.file)), Promise.resolve());
  };

  return (
    <Stack gap="xs">
      <Dropzone onDrop={onDrop} accept={IMAGE_MIME_TYPE} multiple>
        <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={38} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={38} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={38} />
          </Dropzone.Idle>
          <div>
            <Text size="md">{t('media.dropzone.title')}</Text>
            <Text size="sm" c="dimmed">
              {t('media.dropzone.hint')}
            </Text>
          </div>
        </Group>
      </Dropzone>

      {items.length > 0 && (
        <Stack gap={4}>
          {items.map((it) => (
            <Group key={it.id} justify="space-between" wrap="nowrap">
              <Text size="sm" truncate="end" style={{ flex: 1 }}>
                {it.name}
              </Text>
              {it.status === 'queued' && (
                <Text size="xs" c="dimmed">
                  {t('media.status.queued')}
                </Text>
              )}
              {it.status === 'working' && <Loader size="xs" />}
              {it.status === 'done' && (
                <Text size="xs" c="teal">
                  {t('media.status.done')}
                </Text>
              )}
              {it.status === 'error' && (
                <Group gap={4} wrap="nowrap">
                  <Text size="xs" c="red">
                    {t('media.status.error')}
                  </Text>
                  <ActionIcon variant="subtle" size="sm" aria-label={t('media.retry')} onClick={() => void process(it.id, files[it.id])} title={t('media.retry')}>
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
