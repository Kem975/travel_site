import { useDisclosure } from '@mantine/hooks';
import { Button, Group, Image, Select, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ArticleBlock, ImageLayout, PhotoMap } from '../../../api/article';
import type { Photo } from '../../../api/media';
import { MediaPicker } from '../MediaPicker';

type Content = Extract<ArticleBlock, { type: 'image' }>['content'];
type Props = { content: Content; photos: PhotoMap; onChange: (content: Content) => void; onPhoto: (photo: Photo) => void };

export function ImageBlock({ content, photos, onChange, onPhoto }: Props) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const photo = content.photoId ? photos[String(content.photoId)] : undefined;

  return (
    <Stack gap="xs">
      {photo ? (
        <Image src={photo.thumb ?? undefined} alt="" mah={160} fit="contain" radius="sm" />
      ) : (
        <Text c="dimmed" size="sm">
          {t('article.blocks.image.none')}
        </Text>
      )}
      <Group>
        <Button size="xs" variant="default" onClick={open}>
          {photo ? t('article.blocks.image.change') : t('article.blocks.image.choose')}
        </Button>
        <Select
          size="xs"
          w={150}
          data={(['normal', 'wide', 'fullBleed'] as ImageLayout[]).map((l) => ({ value: l, label: t(`article.layouts.${l}`) }))}
          value={content.layout}
          onChange={(v) => onChange({ ...content, layout: (v as ImageLayout | null) ?? 'normal' })}
          allowDeselect={false}
        />
      </Group>
      <TextInput
        size="xs"
        placeholder={t('article.blocks.image.caption')}
        value={content.caption ?? ''}
        onChange={(e) => onChange({ ...content, caption: e.currentTarget.value || null })}
      />
      <MediaPicker
        opened={opened}
        onClose={close}
        onSelect={(p) => {
          onPhoto(p);
          onChange({ ...content, photoId: p.id });
        }}
      />
    </Stack>
  );
}
