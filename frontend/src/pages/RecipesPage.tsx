import { useQuery } from '@tanstack/react-query';
import { Anchor, Badge, Card, Container, Group, Image, Loader, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicRecipeApi } from '../api/recipes';
import { useUiLang } from '../lib/uiLang';

export function RecipesPage() {
  const { t } = useTranslation();
  const lang = useUiLang();
  const { data: recipes, isLoading, isError } = useQuery({
    queryKey: ['public', 'recipes', lang],
    queryFn: () => publicRecipeApi.list(lang),
  });

  return (
    <Container size="md" py="md">
      <Title order={2} mb="lg">
        {t('recipes.title')}
      </Title>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Text c="dimmed">{t('common.loadError')}</Text>
      ) : !recipes || recipes.length === 0 ? (
        <Text c="dimmed">{t('recipes.empty')}</Text>
      ) : (
        <Stack>
          {recipes.map((recipe) => (
            <Card key={recipe.slug} withBorder radius="md" padding="0">
              <Group gap={0} wrap="nowrap" align="stretch">
                {recipe.cover && (
                  <Image src={recipe.cover.thumb ?? undefined} alt="" w={140} h={120} fit="cover" visibleFrom="xs" />
                )}
                <Stack gap={4} p="md" style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Title order={4}>{recipe.title}</Title>
                    <Badge variant="light" size="sm">
                      {recipe.trip_title}
                    </Badge>
                  </Group>
                  {recipe.subtitle && (
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {recipe.subtitle}
                    </Text>
                  )}
                  <Anchor component={Link} to={`/recettes/${recipe.slug}`} size="sm" mt={2}>
                    {t('recipes.read')} →
                  </Anchor>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
