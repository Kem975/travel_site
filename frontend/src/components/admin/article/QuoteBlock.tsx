import { Stack, Textarea, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ArticleBlock } from '../../../api/article';

type Content = Extract<ArticleBlock, { type: 'quote' }>['content'];

export function QuoteBlock({ content, onChange }: { content: Content; onChange: (content: Content) => void }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Textarea
        autosize
        minRows={2}
        placeholder={t('article.blocks.quote.text')}
        value={content.text}
        onChange={(e) => onChange({ ...content, text: e.currentTarget.value })}
      />
      <TextInput
        size="xs"
        placeholder={t('article.blocks.quote.attribution')}
        value={content.attribution ?? ''}
        onChange={(e) => onChange({ ...content, attribution: e.currentTarget.value || null })}
      />
    </Stack>
  );
}
