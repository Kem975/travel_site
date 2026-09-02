import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
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
import { BLOCK_TYPES, emptyBlock, type ArticleBlock, type ArticleLang, type BlockType, type PhotoMap } from '../../../api/article';
import { recipeApi, type RecipeStatus } from '../../../api/recipes';
import { fieldErrors } from '../../../api/client';
import type { Photo } from '../../../api/media';
import { BlockEditor } from '../article/BlockEditor';
import { LineListField } from './LineListField';

// Stable client id per block so reordering never desyncs a TipTap editor instance.
type Row = { id: string; block: ArticleBlock };

/**
 * One language of one recipe. Saving is explicit rather than autosaved: a recipe is
 * a short, deliberate document, and an explicit button avoids carrying the article
 * editor's optimistic-concurrency machinery into a place that doesn't need it.
 */
export function RecipeTranslationEditor({ recipeId, lang }: { recipeId: number; lang: ArticleLang }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recipe', recipeId, lang],
    queryFn: () => recipeApi.get(recipeId, lang),
  });

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [status, setStatus] = useState<RecipeStatus>('draft');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const tr = data.translation;
    setTitle(tr?.title ?? '');
    setSubtitle(tr?.subtitle ?? '');
    setStatus(tr?.status ?? 'draft');
    setIngredients(tr?.ingredients ?? []);
    setSteps(tr?.steps ?? []);
    setRows(data.blocks.map((block) => ({ id: crypto.randomUUID(), block })));
    setPhotos(data.photos);
    setError(null);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      recipeApi.saveTranslation(recipeId, {
        lang,
        title: title.trim(),
        subtitle: subtitle.trim() === '' ? null : subtitle.trim(),
        ingredients,
        steps,
        status,
        blocks: rows.map((r) => r.block),
      }),
    onSuccess: (res) => {
      setPhotos((prev) => ({ ...prev, ...res.photos }));
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      // The list shows the French title and which languages exist — both can change here.
      queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] });
    },
    onError: (e) => {
      const fe = fieldErrors(e);
      setError(fe.blocks ?? fe.title ?? (e instanceof Error ? e.message : 'Error'));
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

  if (isLoading) return <Loader />;

  return (
    <Stack>
      <Group grow align="flex-start">
        <TextInput
          label={t('admin.recipes.fields.title')}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <TextInput
          label={t('admin.recipes.fields.subtitle')}
          value={subtitle}
          onChange={(e) => setSubtitle(e.currentTarget.value)}
        />
        <Select
          label={t('article.fields.status')}
          data={[
            { value: 'draft', label: t('article.status.draft') },
            { value: 'published', label: t('article.status.published') },
          ]}
          value={status}
          onChange={(value) => setStatus((value as RecipeStatus) ?? 'draft')}
          allowDeselect={false}
        />
      </Group>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      <Group grow align="flex-start" wrap="wrap">
        <LineListField
          label={t('recipes.ingredients')}
          addLabel={t('admin.recipes.addIngredient')}
          placeholder={t('admin.recipes.ingredientPlaceholder')}
          value={ingredients}
          onChange={setIngredients}
        />
        <LineListField
          label={t('recipes.steps')}
          addLabel={t('admin.recipes.addStep')}
          placeholder={t('admin.recipes.stepPlaceholder')}
          value={steps}
          onChange={setSteps}
        />
      </Group>

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
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  aria-label={t('common.moveDown')}
                  disabled={i === rows.length - 1}
                  onClick={() => moveBlock(i, 1)}
                >
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

      <Group justify="space-between">
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

        <Group gap="sm">
          {saved && (
            <Text size="sm" c="dimmed">
              {t('article.autosave.saved')}
            </Text>
          )}
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={title.trim() === ''}
          >
            {t('admin.recipes.save')}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
