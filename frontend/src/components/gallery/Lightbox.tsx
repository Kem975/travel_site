import { useEffect } from 'react';
import { ActionIcon, Box, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { Photo } from '../../api/media';

type Props = { photos: Photo[]; index: number | null; onClose: () => void; onIndex: (i: number) => void };

/** Minimal full-screen lightbox with keyboard + arrow navigation (no extra dependency). */
export function Lightbox({ photos, index, onClose, onIndex }: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    if (index === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, photos.length, onClose, onIndex]);

  if (index === null || !photos[index]) {
    return null;
  }
  const photo = photos[index];
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Box
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t('common.close')} onClick={(e) => { stop(e); onClose(); }} style={{ position: 'absolute', top: 16, right: 16 }}>
        <IconX />
      </ActionIcon>
      {index > 0 && (
        <ActionIcon variant="subtle" color="gray" size="xl" aria-label={t('common.previous')} onClick={(e) => { stop(e); onIndex(index - 1); }} style={{ position: 'absolute', left: 12 }}>
          <IconChevronLeft />
        </ActionIcon>
      )}
      {index < photos.length - 1 && (
        <ActionIcon variant="subtle" color="gray" size="xl" aria-label={t('common.next')} onClick={(e) => { stop(e); onIndex(index + 1); }} style={{ position: 'absolute', right: 12 }}>
          <IconChevronRight />
        </ActionIcon>
      )}
      <img
        src={photo.full ?? undefined}
        srcSet={photo.srcset}
        sizes="100vw"
        alt={photo.alt_text ?? ''}
        onClick={stop}
        style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }}
      />
      {photo.caption && (
        <Text c="white" size="sm" style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', opacity: 0.85 }}>
          {photo.caption}
        </Text>
      )}
    </Box>
  );
}
