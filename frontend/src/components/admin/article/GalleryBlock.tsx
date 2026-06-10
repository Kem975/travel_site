import { useDisclosure } from '@mantine/hooks';
import { ActionIcon, Button, Group, Image, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ArticleBlock, GalleryLayout, PhotoMap } from '../../../api/article';
import type { Photo } from '../../../api/media';
import { MediaPicker } from '../MediaPicker';

type Content = Extract<ArticleBlock, { type: 'gallery' }>['content'];
type Props = { content: Content; photos: PhotoMap; onChange: (content: Content) => void; onPhoto: (photo: Photo) => void };

export function GalleryBlock({ content, photos, onChange, onPhoto }: Props) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= content.photoIds.length) return;
    const ids = [...content.photoIds];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onChange({ ...content, photoIds: ids });
  };
  const remove = (i: number) => onChange({ ...content, photoIds: content.photoIds.filter((_, k) => k !== i) });

  return (
    <Stack gap="xs">
      <Group>
        <Button size="xs" variant="default" onClick={open}>
          {t('article.blocks.gallery.add')}
        </Button>
        <Select
          size="xs"
          w={150}
          data={(['grid', 'masonry', 'carousel'] as GalleryLayout[]).map((l) => ({ value: l, label: t(`article.galleryLayouts.${l}`) }))}
          value={content.layout}
          onChange={(v) => onChange({ ...content, layout: (v as GalleryLayout | null) ?? 'grid' })}
          allowDeselect={false}
        />
      </Group>
      {content.photoIds.length > 0 ? (
        <SimpleGrid cols={{ base: 3, sm: 4 }}>
          {content.photoIds.map((id, i) => (
            <Stack key={`${id}-${i}`} gap={2}>
              <Image src={photos[String(id)]?.thumb ?? undefined} alt="" h={70} fit="cover" radius="sm" />
              <Group gap={2} justify="center">
                <ActionIcon size="xs" variant="subtle" aria-label={t('common.moveLeft')} disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconArrowLeft size={12} />
                </ActionIcon>
                <ActionIcon size="xs" variant="subtle" color="red" aria-label={t('common.remove')} onClick={() => remove(i)}>
                  <IconX size={12} />
                </ActionIcon>
                <ActionIcon size="xs" variant="subtle" aria-label={t('common.moveRight')} disabled={i === content.photoIds.length - 1} onClick={() => move(i, 1)}>
                  <IconArrowRight size={12} />
                </ActionIcon>
              </Group>
            </Stack>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">
          {t('article.blocks.gallery.empty')}
        </Text>
      )}
      <MediaPicker
        opened={opened}
        onClose={close}
        onSelect={(p) => {
          onPhoto(p);
          onChange({ ...content, photoIds: [...content.photoIds, p.id] });
        }}
      />
    </Stack>
  );
}
