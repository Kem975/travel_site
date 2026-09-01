import { useState } from 'react';
import { Box, Image, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ArticleBlock } from '../../../api/article';
import { youtubeId, youtubeThumbnail } from '../../../lib/youtube';

type Content = Extract<ArticleBlock, { type: 'video' }>['content'];

export function VideoBlock({ content, onChange }: { content: Content; onChange: (content: Content) => void }) {
  const { t } = useTranslation();
  // What the user typed, kept separate from the stored id so a half-pasted URL
  // doesn't wipe a valid video while they edit.
  const [input, setInput] = useState(content.videoId);

  const apply = (value: string) => {
    setInput(value);
    const id = youtubeId(value);
    onChange({ ...content, videoId: id ?? '' });
  };

  const invalid = input.trim() !== '' && content.videoId === '';

  return (
    <Stack gap="xs">
      <TextInput
        placeholder={t('article.blocks.video.url')}
        value={input}
        onChange={(e) => apply(e.currentTarget.value)}
        error={invalid ? t('article.blocks.video.invalid') : undefined}
      />
      {content.videoId !== '' && (
        <Box w={240}>
          <Image src={youtubeThumbnail(content.videoId)} radius="sm" alt="" />
        </Box>
      )}
      {content.videoId === '' && !invalid && (
        <Text size="sm" c="dimmed">
          {t('article.blocks.video.none')}
        </Text>
      )}
      <TextInput
        size="xs"
        placeholder={t('article.blocks.video.caption')}
        value={content.caption ?? ''}
        onChange={(e) => onChange({ ...content, caption: e.currentTarget.value || null })}
      />
    </Stack>
  );
}
