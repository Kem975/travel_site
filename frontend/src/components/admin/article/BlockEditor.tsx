import { Text } from '@mantine/core';
import type { ArticleBlock, PhotoMap } from '../../../api/article';
import type { Photo } from '../../../api/media';
import { RichTextBlock } from './RichTextBlock';
import { ImageBlock } from './ImageBlock';
import { GalleryBlock } from './GalleryBlock';
import { QuoteBlock } from './QuoteBlock';
import { PracticalInfoBlock } from './PracticalInfoBlock';

type Props = {
  block: ArticleBlock;
  photos: PhotoMap;
  onChange: (block: ArticleBlock) => void;
  onPhoto: (photo: Photo) => void;
};

export function BlockEditor({ block, photos, onChange, onPhoto }: Props) {
  switch (block.type) {
    case 'richText':
      return <RichTextBlock html={block.content.html} onChange={(html) => onChange({ type: 'richText', content: { html } })} />;
    case 'image':
      return (
        <ImageBlock
          content={block.content}
          photos={photos}
          onPhoto={onPhoto}
          onChange={(content) => onChange({ type: 'image', content })}
        />
      );
    case 'gallery':
      return (
        <GalleryBlock
          content={block.content}
          photos={photos}
          onPhoto={onPhoto}
          onChange={(content) => onChange({ type: 'gallery', content })}
        />
      );
    case 'quote':
      return <QuoteBlock content={block.content} onChange={(content) => onChange({ type: 'quote', content })} />;
    case 'practicalInfo':
      return <PracticalInfoBlock content={block.content} onChange={(content) => onChange({ type: 'practicalInfo', content })} />;
    case 'divider':
      return (
        <Text c="dimmed" size="sm" ta="center">
          ⎯⎯⎯
        </Text>
      );
  }
}
