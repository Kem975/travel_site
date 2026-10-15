import { ActionIcon, Card, Group, Select, SimpleGrid, Text } from '@mantine/core';
import { IconArrowsLeftRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  COLUMN_BLOCK_TYPES,
  emptyColumnBlock,
  type ArticleBlock,
  type ColumnBlockType,
  type PhotoMap,
} from '../../../api/article';
import type { Photo } from '../../../api/media';
import { BlockEditor } from './BlockEditor';

type Content = Extract<ArticleBlock, { type: 'columns' }>['content'];
type Props = {
  content: Content;
  photos: PhotoMap;
  onChange: (content: Content) => void;
  onPhoto: (photo: Photo) => void;
  uploadTo?: number;
};

const SIDES = ['left', 'right'] as const;

/**
 * Two blocks side by side. Each side picks its own type, so this is a layout, not
 * a video-pair widget — the pairing it was added for is just the default.
 *
 * Renders BlockEditor for each side, which renders this for a `columns` block:
 * the recursion is real but bounded, because a side can only ever be a
 * ColumnBlock and `columns` is not one of those.
 */
export function ColumnsBlock({ content, photos, onChange, onPhoto, uploadTo }: Props) {
  const { t } = useTranslation();

  const typeData = COLUMN_BLOCK_TYPES.map((type) => ({ value: type, label: t(`article.types.${type}`) }));

  return (
    <>
      <Group justify="flex-end" mb="xs">
        <ActionIcon
          size="sm"
          variant="subtle"
          aria-label={t('article.blocks.columns.swap')}
          onClick={() => onChange({ left: content.right, right: content.left })}
        >
          <IconArrowsLeftRight size={14} />
        </ActionIcon>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        {SIDES.map((side) => (
          <Card key={side} withBorder radius="sm" padding="xs">
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Text size="xs" tt="uppercase" c="dimmed">
                {t(`article.blocks.columns.${side}`)}
              </Text>
              <Select
                size="xs"
                w={150}
                allowDeselect={false}
                data={typeData}
                value={content[side].type}
                onChange={(v) => {
                  // Switching type starts that side from scratch: an image's photo
                  // id means nothing to a quote, so carrying content over would
                  // only produce a block that fails validation in a confusing way.
                  if (v) onChange({ ...content, [side]: emptyColumnBlock(v as ColumnBlockType) });
                }}
              />
            </Group>
            <BlockEditor
              block={content[side]}
              photos={photos}
              onPhoto={onPhoto}
              uploadTo={uploadTo}
              onChange={(block) => {
                // A side is a ColumnBlock. The editor below can only emit the type
                // it was given, so this narrowing never actually rejects anything —
                // it is here so the cast isn't.
                if (block.type !== 'columns' && block.type !== 'divider') {
                  onChange({ ...content, [side]: block });
                }
              }}
            />
          </Card>
        ))}
      </SimpleGrid>
    </>
  );
}
