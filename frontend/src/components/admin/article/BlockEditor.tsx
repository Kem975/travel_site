import { Text } from '@mantine/core';
import type { ArticleBlock, PhotoMap } from '../../../api/article';
import type { Photo } from '../../../api/media';
import { RichTextBlock } from './RichTextBlock';
import { ImageBlock } from './ImageBlock';
import { GalleryBlock } from './GalleryBlock';
import { VideoBlock } from './VideoBlock';
import { QuoteBlock } from './QuoteBlock';
import { PracticalInfoBlock } from './PracticalInfoBlock';

type Props = {
  block: ArticleBlock;
  photos: PhotoMap;
  onChange: (block: ArticleBlock) => void;
  onPhoto: (photo: Photo) => void;
  /** Stop that photos uploaded from inside this article are filed under. */
  uploadTo?: number;
};

export function BlockEditor({ block, photos, onChange, onPhoto, uploadTo }: Props) {
  switch (block.type) {
    case 'richText':
      return <RichTextBlock content={block.content} onChange={(content) => onChange({ type: 'richText', content })} />;
    case 'image':
      return (
        <ImageBlock
          content={block.content}
          photos={photos}
          onPhoto={onPhoto}
          uploadTo={uploadTo}
          onChange={(content) => onChange({ type: 'image', content })}
        />
      );
    case 'gallery':
      return (
        <GalleryBlock
          content={block.content}
          photos={photos}
          onPhoto={onPhoto}
          uploadTo={uploadTo}
          onChange={(content) => onChange({ type: 'gallery', content })}
        />
      );
    case 'video':
      return <VideoBlock content={block.content} onChange={(content) => onChange({ type: 'video', content })} />;
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
