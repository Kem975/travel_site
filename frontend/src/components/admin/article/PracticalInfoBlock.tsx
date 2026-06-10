import { ActionIcon, Button, Group, Stack, TextInput } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ArticleBlock, PracticalItem } from '../../../api/article';

type Content = Extract<ArticleBlock, { type: 'practicalInfo' }>['content'];

export function PracticalInfoBlock({ content, onChange }: { content: Content; onChange: (content: Content) => void }) {
  const { t } = useTranslation();

  const setItem = (i: number, patch: Partial<PracticalItem>) =>
    onChange({ items: content.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const add = () => onChange({ items: [...content.items, { label: '', value: '' }] });
  const remove = (i: number) => onChange({ items: content.items.filter((_, k) => k !== i) });

  return (
    <Stack gap="xs">
      {content.items.map((item, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            w={170}
            placeholder={t('article.blocks.practical.label')}
            value={item.label}
            onChange={(e) => setItem(i, { label: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            style={{ flex: 1 }}
            placeholder={t('article.blocks.practical.value')}
            value={item.value}
            onChange={(e) => setItem(i, { value: e.currentTarget.value })}
          />
          <ActionIcon size="sm" variant="subtle" color="red" aria-label={t('common.remove')} onClick={() => remove(i)}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={add}>
        {t('article.blocks.practical.add')}
      </Button>
    </Stack>
  );
}
