import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
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
import { IconArrowDown, IconArrowUp, IconDeviceFloppy, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  articleApi,
  BLOCK_TYPES,
  emptyBlock,
  type ArticleBlock,
  type ArticleLang,
  type ArticleStatus,
  type BlockType,
  type PhotoMap,
} from '../../../api/article';
import type { Photo } from '../../../api/media';
import { ApiError, fieldErrors } from '../../../api/client';
import { BlockEditor } from './BlockEditor';

// Stable client id per block so reordering never desyncs a TipTap editor instance.
type Row = { id: string; block: ArticleBlock };
const AUTOSAVE_MS = 2000;

const snapshotOf = (title: string, subtitle: string, status: ArticleStatus, blocks: ArticleBlock[]) =>
  JSON.stringify({ title, subtitle, status, blocks });

// One language at a time. The page remounts this on a language switch (key={lang}),
// so every piece of per-article state below — rows, version, autosave snapshot —
// starts clean rather than carrying the other language's over.
export function ArticleEditor({ destinationId, lang }: { destinationId: number; lang: ArticleLang }) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'article', destinationId, lang],
    queryFn: () => articleApi.get(destinationId, lang),
  });

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [rows, setRows] = useState<Row[]>([]);
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [version, setVersion] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef('');

  useEffect(() => {
    if (!data) return;
    const a = data.article;
    const st: ArticleStatus = a?.status === 'published' ? 'published' : 'draft';
    setTitle(a?.title ?? '');
    setSubtitle(a?.subtitle ?? '');
    setStatus(st);
    setRows(data.blocks.map((block) => ({ id: crypto.randomUUID(), block })));
    setPhotos(data.photos);
    setVersion(a?.version ?? null);
    setSavedSnapshot(snapshotOf(a?.title ?? '', a?.subtitle ?? '', st, data.blocks));
    setConflict(false);
    setError(null);
  }, [data]);

  const blocks = rows.map((r) => r.block);
  const currentSnapshot = snapshotOf(title, subtitle, status, blocks);
  const dirty = currentSnapshot !== savedSnapshot;

  const save = useMutation({
    mutationFn: () =>
      articleApi.save(destinationId, { lang, title, subtitle, status, version: version ?? undefined, blocks }),
    onMutate: () => {
      inFlight.current = currentSnapshot;
    },
    onSuccess: (res) => {
      setSavedSnapshot(inFlight.current);
      setVersion(res.article?.version ?? version);
      setPhotos((prev) => ({ ...prev, ...res.photos }));
      setConflict(false);
      setError(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true); // stop autosave; user must reload
        return;
      }
      const fe = fieldErrors(e);
      setError(fe.blocks ?? (e instanceof Error ? e.message : 'Error'));
    },
  });

  // Debounced autosave: fire AUTOSAVE_MS after the last edit settles.
  useEffect(() => {
    if (!dirty || conflict || save.isPending) return;
    const id = window.setTimeout(() => save.mutate(), AUTOSAVE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, savedSnapshot, conflict, save.isPending]);

  // Warn before closing/reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

  const statusBadge = conflict ? (
    <Badge color="red" variant="light">
      {t('article.autosave.conflict')}
    </Badge>
  ) : save.isPending ? (
    <Badge color="blue" variant="light">
      {t('article.autosave.saving')}
    </Badge>
  ) : dirty ? (
    <Badge color="yellow" variant="light">
      {t('article.autosave.unsaved')}
    </Badge>
  ) : (
    <Badge color="teal" variant="light">
      {t('article.autosave.saved')}
    </Badge>
  );

  return (
    <Stack>
      {conflict && (
        <Alert color="red" title={t('article.autosave.conflictTitle')}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t('article.autosave.conflictBody')}</Text>
            <Button size="xs" leftSection={<IconRefresh size={14} />} onClick={() => void refetch()}>
              {t('article.autosave.reload')}
            </Button>
          </Group>
        </Alert>
      )}

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
                <ActionIcon size="sm" variant="subtle" aria-label={t('common.moveUp')} disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                  <IconArrowUp size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" aria-label={t('common.moveDown')} disabled={i === rows.length - 1} onClick={() => moveBlock(i, 1)}>
                  <IconArrowDown size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => removeBlock(i)}>
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
          onChange={(v) => setStatus((v as ArticleStatus | null) ?? 'draft')}
        />
        <Group>
          {statusBadge}
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            loading={save.isPending}
            disabled={!dirty || conflict}
            onClick={() => save.mutate()}
          >
            {t('article.save')}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
