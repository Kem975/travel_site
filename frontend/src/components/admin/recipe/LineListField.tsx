import { ActionIcon, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

type Props = {
  label: string;
  addLabel: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
};

/**
 * An ordered list of plain lines — ingredients, or steps. Blank lines survive
 * editing (you need an empty row to type into) and are dropped server-side, so an
 * abandoned row never reaches the page.
 */
export function LineListField({ label, addLabel, placeholder, value, onChange }: Props) {
  const { t } = useTranslation();

  const setAt = (index: number, line: string) => onChange(value.map((v, i) => (i === index ? line : v)));
  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {label}
      </Text>
      {value.map((line, i) => (
        <Group key={i} gap={4} wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={line}
            placeholder={placeholder}
            onChange={(event) => setAt(i, event.currentTarget.value)}
          />
          <ActionIcon variant="subtle" size="sm" aria-label={t('common.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
            <IconArrowUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            aria-label={t('common.moveDown')}
            disabled={i === value.length - 1}
            onClick={() => move(i, 1)}
          >
            <IconArrowDown size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" size="sm" color="red" aria-label={t('common.remove')} onClick={() => removeAt(i)}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="subtle"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...value, ''])}
        style={{ alignSelf: 'flex-start' }}
      >
        {addLabel}
      </Button>
    </Stack>
  );
}
