import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Anchor,
  Button,
  Card,
  Container,
  Group,
  Image,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconExternalLink } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { mediaApi } from '../../api/media';
import { recipeApi } from '../../api/recipes';
import type { ArticleLang } from '../../api/article';
import { MediaPicker } from '../../components/admin/MediaPicker';
import { RecipeTranslationEditor } from '../../components/admin/recipe/RecipeTranslationEditor';

const LANGS: ArticleLang[] = ['fr', 'en'];

export function RecipeEditorPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { recipeId: param } = useParams();
  const recipeId = Number(param);
  const valid = Number.isFinite(recipeId);
  const [lang, setLang] = useState<ArticleLang>('fr');
  const [pickerOpen, { open: openPicker, close: closePicker }] = useDisclosure(false);

  // The identity half is language-independent, so it is read once (in French) and
  // does not reload when the tabs change.
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recipe', recipeId, 'fr'],
    queryFn: () => recipeApi.get(recipeId, 'fr'),
    enabled: valid,
  });
  const recipe = data?.recipe;

  const { data: trips } = useQuery({ queryKey: ['admin', 'trips'], queryFn: adminApi.listTrips });
  const { data: destinations } = useQuery({
    queryKey: ['admin', 'destinations', recipe?.trip_id],
    queryFn: () => adminApi.listDestinations(recipe!.trip_id),
    enabled: recipe?.trip_id != null,
  });
  const cover = useQuery({
    queryKey: ['admin', 'photo', recipe?.cover_photo_id],
    queryFn: () => mediaApi.get(recipe!.cover_photo_id as number),
    enabled: recipe?.cover_photo_id != null,
  });

  const [tripId, setTripId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (!recipe) return;
    setTripId(String(recipe.trip_id));
    setDestinationId(recipe.destination_id == null ? null : String(recipe.destination_id));
    setSlug(recipe.slug);
  }, [recipe]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'recipe', recipeId] });

  const saveIdentity = useMutation({
    mutationFn: () =>
      recipeApi.update(recipeId, {
        trip_id: Number(tripId),
        destination_id: destinationId === null ? null : Number(destinationId),
        slug: slug.trim(),
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] });
    },
  });
  const setCover = useMutation({
    mutationFn: (photoId: number | null) => recipeApi.setCover(recipeId, photoId),
    onSuccess: invalidate,
  });

  if (!valid || isLoading) return <Loader />;
  if (!recipe) {
    return (
      <Container size="md" py="md">
        <Text c="dimmed">{t('recipes.notFound')}</Text>
      </Container>
    );
  }

  return (
    <Container size="md" py="md">
      <Group justify="space-between" mb="md" align="flex-end">
        <div>
          <Anchor component={Link} to="/admin/recettes" size="sm">
            ← {t('admin.recipes.title')}
          </Anchor>
          <Title order={2}>{data?.translation?.title ?? recipe.slug}</Title>
        </div>
        <Button
          component="a"
          href={`/recettes/${recipe.slug}`}
          target="_blank"
          variant="default"
          size="xs"
          leftSection={<IconExternalLink size={14} />}
        >
          {t('article.viewPublic')}
        </Button>
      </Group>

      <Card withBorder radius="md" padding="md" mb="md">
        <Stack>
          <Group grow align="flex-start">
            <Select
              label={t('admin.recipes.fields.trip')}
              data={(trips ?? []).map((trip) => ({ value: String(trip.id), label: trip.title }))}
              value={tripId}
              onChange={(value) => {
                setTripId(value);
                setDestinationId(null); // a stop from the old country would be rejected
              }}
              allowDeselect={false}
            />
            <Select
              label={t('admin.recipes.fields.destination')}
              description={t('admin.recipes.fields.destinationHint')}
              data={(destinations ?? []).map((d) => ({ value: String(d.id), label: d.title }))}
              value={destinationId}
              onChange={setDestinationId}
              clearable
            />
            <TextInput label={t('admin.recipes.fields.slug')} value={slug} onChange={(e) => setSlug(e.currentTarget.value)} />
          </Group>

          <Group align="flex-end" justify="space-between">
            <Group gap="sm" align="center">
              {cover.data ? (
                <Image src={cover.data.thumb ?? undefined} alt="" w={96} h={64} fit="cover" radius="sm" />
              ) : (
                <Text size="sm" c="dimmed">
                  {t('admin.recipes.noCover')}
                </Text>
              )}
              <Button variant="default" size="xs" onClick={openPicker}>
                {t(recipe.cover_photo_id == null ? 'admin.recipes.chooseCover' : 'admin.recipes.changeCover')}
              </Button>
              {recipe.cover_photo_id != null && (
                <Button variant="subtle" color="red" size="xs" onClick={() => setCover.mutate(null)}>
                  {t('common.remove')}
                </Button>
              )}
            </Group>
            <Button onClick={() => saveIdentity.mutate()} loading={saveIdentity.isPending} variant="light">
              {t('admin.recipes.saveIdentity')}
            </Button>
          </Group>
        </Stack>
      </Card>

      <SegmentedControl
        mb="md"
        value={lang}
        onChange={(value) => setLang(value as ArticleLang)}
        data={LANGS.map((code) => ({ value: code, label: t(`common.langNames.${code}`) }))}
      />
      {/* key: a language switch is a different document, so remount rather than leak
          the previous one's ingredients, steps and blocks into the new one. */}
      <RecipeTranslationEditor key={lang} recipeId={recipeId} lang={lang} />

      <MediaPicker
        opened={pickerOpen}
        onClose={closePicker}
        onSelect={(photo) => {
          setCover.mutate(photo.id);
          closePicker();
        }}
      />
    </Container>
  );
}
