import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  articleApi,
  BLOCK_TYPES,
  emptyBlock,
  type ArticleBlock,
  type ArticleStatus,
  type BlockType,
  type PhotoMap,
} from '../../../api/article';
import type { Photo } from '../../../api/media';
import { fieldErrors } from '../../../api/client';
import { BlockEditor } from './BlockEditor';

// Stable client id per block so reordering never desyncs a TipTap editor instance.
type Row = { id: string; block: ArticleBlock };

export function ArticleEditor({ destinationId }: { destinationId: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'article', destinationId],
    queryFn: () => articleApi.get(destinationId),
  });

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [rows, setRows] = useState<Row[]>([]);
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.article?.title ?? '');
    setSubtitle(data.article?.subtitle ?? '');
    setStatus(data.article?.status === 'published' ? 'published' : 'draft');
    setRows(data.blocks.map((block) => ({ id: crypto.randomUUID(), block })));
    setPhotos(data.photos);
  }, [data]);

  const save = useMutation({
    mutationFn: () => articleApi.save(destinationId, { title, subtitle, status, blocks: rows.map((r) => r.block) }),
    onSuccess: (res) => {
      setPhotos((prev) => ({ ...prev, ...res.photos }));
      setError(null);
      setSaved(true);
    },
    onError: (e) => {
      const fe = fieldErrors(e);
      setError(fe.blocks ?? (e instanceof Error ? e.message : 'Error'));
      setSaved(false);
    },
  });

  const addBlock = (type: BlockType) => setRows((r) => [...r, { id: crypto.randomUUID(), block: emptyBlock(type) }]);
  const updateBlock = (i: number, block: ArticleBlock) => setRows((r) => r.map((x, k) => (k === i ? { ...x, block } : x)));
  const removeBlock = (i: number) => setRows((r) => r.filter((_, k) => k !== i));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const registerPhoto = (photo: Photo) => setPhotos((p) => ({ ...p, [String(photo.id)]: photo }));

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group grow>
        <TextInput label={t('article.fields.title')} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextInput label={t('article.fields.subtitle')} value={subtitle} onChange={(e) => setSubtitle(e.currentTarget.value)} />
      </Group>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      <Stack>
        {rows.map((row, i) => (
          <Card key={row.id} withBorder radius="md" padding="sm">
            <Group justify="space-between" mb="xs">
              <Text size="xs" tt="uppercase" c="dimmed">
                {t(`article.types.${row.block.type}`)}
              </Text>
              <Group gap={2}>
                <ActionIcon size="sm" variant="subtle" disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                  <IconArrowUp size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" disabled={i === rows.length - 1} onClick={() => moveBlock(i, 1)}>
                  <IconArrowDown size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeBlock(i)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Group>
            <BlockEditor block={row.block} photos={photos} onChange={(b) => updateBlock(i, b)} onPhoto={registerPhoto} />
          </Card>
        ))}
      </Stack>

      <Menu position="bottom-start">
        <Menu.Target>
          <Button variant="light" leftSection={<IconPlus size={16} />}>
            {t('article.addBlock')}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {BLOCK_TYPES.map((type) => (
            <Menu.Item key={type} onClick={() => addBlock(type)}>
              {t(`article.types.${type}`)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Divider />
      <Group justify="space-between">
        <Select
          label={t('article.fields.status')}
          w={200}
          allowDeselect={false}
          data={(['draft', 'published'] as ArticleStatus[]).map((s) => ({ value: s, label: t(`article.status.${s}`) }))}
          value={status}
          onChange={(v) => {
            setStatus((v as ArticleStatus | null) ?? 'draft');
            setSaved(false);
          }}
        />
        <Group>
          {saved && !save.isPending && (
            <Text size="sm" c="teal">
              {t('article.saved')}
            </Text>
          )}
          <Button leftSection={<IconDeviceFloppy size={16} />} loading={save.isPending} onClick={() => save.mutate()}>
            {t('article.save')}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
