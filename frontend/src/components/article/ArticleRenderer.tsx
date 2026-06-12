import type { ReactNode } from 'react';
import { Blockquote, Box, Divider, Group, ScrollArea, SimpleGrid, Stack, Table, Text, TypographyStylesProvider } from '@mantine/core';
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

function ResponsiveImg({ photo, rounded = true, height }: { photo: Photo; rounded?: boolean; height?: number }) {
  return (
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
  );
}

function BlockView({ block, photos }: { block: ArticleBlock; photos: PhotoMap }) {
  switch (block.type) {
    case 'richText':
      return (
        <Centered max={TEXT_WIDTH}>
          <TypographyStylesProvider className="article-typography">
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
          <ResponsiveImg photo={photo} rounded={block.content.layout !== 'fullBleed'} />
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
                  <ResponsiveImg photo={photo} height={200} />
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
                  <ResponsiveImg photo={photo} />
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
              <ResponsiveImg key={`${photo.id}-${i}`} photo={photo} height={180} />
            ))}
          </SimpleGrid>
        </Centered>
      );
    }

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

    case 'divider':
      return (
        <Centered max={TEXT_WIDTH}>
          <Divider my="md" />
        </Centered>
      );
  }
}

export function ArticleRenderer({ blocks, photos }: { blocks: ArticleBlock[]; photos: PhotoMap }) {
  return (
    <Stack gap="xl">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} photos={photos} />
      ))}
    </Stack>
  );
}
