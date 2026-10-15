import { useState, type ReactNode } from 'react';
import { Blockquote, Box, Divider, Group, ScrollArea, SimpleGrid, Stack, Table, Text, TypographyStylesProvider, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Lightbox } from '../gallery/Lightbox';
import { YoutubeEmbed } from './YoutubeEmbed';
import type { ArticleBlock, PhotoMap } from '../../api/article';
import type { Photo } from '../../api/media';

const TEXT_WIDTH = 720; // narrow reading column (plan §6.4)

function Centered({ max, children }: { max: number | string; children: ReactNode }) {
  return (
    <Box mx="auto" w="100%" style={{ maxWidth: max }}>
      {children}
    </Box>
  );
}

function ResponsiveImg({
  photo,
  rounded = true,
  height,
  onOpen,
}: {
  photo: Photo;
  rounded?: boolean;
  height?: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <UnstyledButton
      onClick={onOpen}
      aria-label={t('gallery.viewPhoto')}
      style={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
    >
      <img
        src={photo.full ?? undefined}
        srcSet={photo.srcset}
        sizes="(max-width: 1200px) 100vw, 1200px"
        alt={photo.alt_text ?? ''}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        style={{ width: '100%', height: height ? height : 'auto', objectFit: 'cover', borderRadius: rounded ? 8 : 0, display: 'block' }}
      />
    </UnstyledButton>
  );
}

function BlockView({
  block,
  photos,
  offset,
  onOpen,
}: {
  block: ArticleBlock;
  photos: PhotoMap;
  offset: number;
  onOpen: (index: number) => void;
}) {
  switch (block.type) {
    case 'richText':
      return (
        <Centered max={TEXT_WIDTH}>
          <TypographyStylesProvider
            className={`article-typography${block.content.size === 'small' ? ' article-typography--small' : ''}`}
            style={{ textAlign: block.content.align === 'center' ? 'center' : undefined }}
          >
            {/* Sanitized server-side (PLAN_REVIEW A3) */}
            <div dangerouslySetInnerHTML={{ __html: block.content.html }} />
          </TypographyStylesProvider>
        </Centered>
      );

    case 'image': {
      const photo = photos[String(block.content.photoId)];
      if (!photo) return null;
      const max = block.content.layout === 'fullBleed' ? '100%' : block.content.layout === 'wide' ? 1200 : 900;
      return (
        <Box component="figure" mx="auto" w="100%" m={0} style={{ maxWidth: max }}>
          <ResponsiveImg photo={photo} rounded={block.content.layout !== 'fullBleed'} onOpen={() => onOpen(offset)} />
          {block.content.caption && (
            <Text component="figcaption" size="sm" c="dimmed" ta="center" mt={6}>
              {block.content.caption}
            </Text>
          )}
        </Box>
      );
    }

    case 'gallery': {
      const list = block.content.photoIds.map((id) => photos[String(id)]).filter((p): p is Photo => Boolean(p));
      if (list.length === 0) return null;
      if (block.content.layout === 'carousel') {
        return (
          <ScrollArea>
            <Group wrap="nowrap" gap="sm" align="stretch">
              {list.map((photo, i) => (
                <Box key={`${photo.id}-${i}`} w={280} style={{ flexShrink: 0 }}>
                  <ResponsiveImg photo={photo} height={200} onOpen={() => onOpen(offset + i)} />
                </Box>
              ))}
            </Group>
          </ScrollArea>
        );
      }
      if (block.content.layout === 'masonry') {
        return (
          <Centered max={1200}>
            <Box style={{ columnCount: 3, columnGap: 12 }}>
              {list.map((photo, i) => (
                <Box key={`${photo.id}-${i}`} mb={12} style={{ breakInside: 'avoid' }}>
                  <ResponsiveImg photo={photo} onOpen={() => onOpen(offset + i)} />
                </Box>
              ))}
            </Box>
          </Centered>
        );
      }
      return (
        <Centered max={1200}>
          <SimpleGrid cols={{ base: 2, sm: 3 }}>
            {list.map((photo, i) => (
              <ResponsiveImg key={`${photo.id}-${i}`} photo={photo} height={180} onOpen={() => onOpen(offset + i)} />
            ))}
          </SimpleGrid>
        </Centered>
      );
    }

    case 'video':
      if (block.content.videoId === '') return null;
      return (
        <Centered max={900}>
          <Box component="figure" m={0}>
            <YoutubeEmbed videoId={block.content.videoId} title={block.content.caption ?? undefined} />
            {block.content.caption && (
              <Text component="figcaption" size="sm" c="dimmed" ta="center" mt={6}>
                {block.content.caption}
              </Text>
            )}
          </Box>
        </Centered>
      );

    case 'quote':
      return (
        <Centered max={TEXT_WIDTH}>
          <Blockquote color="travelTeal" cite={block.content.attribution ?? undefined}>
            {block.content.text}
          </Blockquote>
        </Centered>
      );

    case 'practicalInfo':
      return (
        <Centered max={TEXT_WIDTH}>
          <Table withRowBorders>
            <Table.Tbody>
              {block.content.items.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Th w="40%">{item.label}</Table.Th>
                  <Table.Td>{item.value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Centered>
      );

    case 'columns':
      return (
        <Centered max={1200}>
          {/* One column on a phone: half of a reading column is not a column.
              Stacking keeps left above right, which is the order the lightbox
              indices below were built in. */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
            <BlockView block={block.content.left} photos={photos} offset={offset} onOpen={onOpen} />
            <BlockView
              block={block.content.right}
              photos={photos}
              offset={offset + photosIn(block.content.left, photos).length}
              onOpen={onOpen}
            />
          </SimpleGrid>
        </Centered>
      );

    case 'divider':
      return (
        <Centered max={TEXT_WIDTH}>
          <Divider my="md" />
        </Centered>
      );
  }
}

/**
 * The photos one block contributes, in reading order — columns left then right,
 * which is also the order they stack in on a narrow screen.
 *
 * It must skip exactly the photos BlockView skips, or every lightbox index after
 * the gap points at the wrong picture.
 */
function photosIn(block: ArticleBlock, photos: PhotoMap): Photo[] {
  switch (block.type) {
    case 'image': {
      const photo = photos[String(block.content.photoId)];
      return photo ? [photo] : [];
    }
    case 'gallery':
      return block.content.photoIds.map((id) => photos[String(id)]).filter((p): p is Photo => Boolean(p));
    case 'columns':
      return [...photosIn(block.content.left, photos), ...photosIn(block.content.right, photos)];
    default:
      return [];
  }
}

/**
 * Every article photo in reading order, so the lightbox arrows walk the whole
 * article rather than stopping at the block boundary.
 */
function collectPhotos(blocks: ArticleBlock[], photos: PhotoMap) {
  const flat: Photo[] = [];
  const offsets = blocks.map((block) => {
    const offset = flat.length;
    flat.push(...photosIn(block, photos));
    return offset;
  });
  return { flat, offsets };
}

export function ArticleRenderer({ blocks, photos }: { blocks: ArticleBlock[]; photos: PhotoMap }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { flat, offsets } = collectPhotos(blocks, photos);

  return (
    <>
      <Stack gap="xl">
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} photos={photos} offset={offsets[i]} onOpen={setLightbox} />
        ))}
      </Stack>
      <Lightbox photos={flat} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </>
  );
}
