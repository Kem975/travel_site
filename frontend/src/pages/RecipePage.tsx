import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Grid,
  Group,
  List,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicRecipeApi } from '../api/recipes';
import type { ArticleLang } from '../api/article';
import { ApiError } from '../api/client';
import { ArticleRenderer } from '../components/article/ArticleRenderer';
import { useUiLang } from '../lib/uiLang';

export function RecipePage() {
  const { t } = useTranslation();
  const { recipeSlug } = useParams();
  const [override, setOverride] = useState<ArticleLang | null>(null);
  const uiLang = useUiLang();
  const lang = override ?? uiLang;

  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'recipe', recipeSlug, lang],
    queryFn: () => publicRecipeApi.get(recipeSlug as string, lang),
    enabled: Boolean(recipeSlug),
    retry: false,
  });

  if (isLoading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Container size="sm" py="xl">
        <Text c="dimmed">{notFound ? t('recipes.notFound') : t('common.loadError')}</Text>
      </Container>
    );
  }

  // No hero photo here — that treatment belongs to the destination articles, and a
  // recipe should open on what you actually need: what to buy and what to do.
  return (
    <Container size="lg" py="md">
      <Stack gap="xl">
        <Box>
          <Anchor component={Link} to="/recettes" size="sm">
            ← {t('recipes.title')}
          </Anchor>
          <Group gap="sm" mt="xs" align="center">
            <Title order={1}>{data.translation?.title ?? recipeSlug}</Title>
            <Badge variant="light">{data.trip.title}</Badge>
          </Group>
          {data.translation?.subtitle && (
            <Text c="dimmed" mt="xs" style={{ maxWidth: '40rem' }}>
              {data.translation.subtitle}
            </Text>
          )}
        </Box>

        {data.translation === null ? (
          <Alert
            variant="light"
            title={t('article.public.missingTranslation.title', {
              language: t(`common.languages.${data.lang}`),
            })}
          >
            <Stack align="flex-start" gap="md">
              <Text size="sm">{t('recipes.missingTranslation')}</Text>
              <Button variant="light" onClick={() => setOverride(data.available_langs[0])}>
                {t('article.public.missingTranslation.action', {
                  language: t(`common.languages.${data.available_langs[0]}`),
                })}
              </Button>
            </Stack>
          </Alert>
        ) : (
          <>
            <Grid gutter="xl">
              <Grid.Col span={{ base: 12, sm: 5, md: 4 }}>
                <Title order={3} mb="sm">
                  {t('recipes.ingredients')}
                </Title>
                {data.translation.ingredients.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    {t('recipes.noIngredients')}
                  </Text>
                ) : (
                  <List spacing="xs" size="sm">
                    {data.translation.ingredients.map((item, i) => (
                      <List.Item key={i}>{item}</List.Item>
                    ))}
                  </List>
                )}
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 7, md: 8 }}>
                <Title order={3} mb="sm">
                  {t('recipes.steps')}
                </Title>
                {data.translation.steps.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    {t('recipes.noSteps')}
                  </Text>
                ) : (
                  <List type="ordered" spacing="md">
                    {data.translation.steps.map((step, i) => (
                      <List.Item key={i}>{step}</List.Item>
                    ))}
                  </List>
                )}
              </Grid.Col>
            </Grid>

            {data.blocks.length > 0 && <ArticleRenderer blocks={data.blocks} photos={data.photos} />}
          </>
        )}
      </Stack>
    </Container>
  );
}
