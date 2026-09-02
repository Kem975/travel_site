import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { recipeApi } from '../../api/recipes';

export function RecipesListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: recipes, isLoading } = useQuery({ queryKey: ['admin', 'recipes'], queryFn: recipeApi.list });
  const { data: trips } = useQuery({ queryKey: ['admin', 'trips'], queryFn: adminApi.listTrips });
  const [opened, { open, close }] = useDisclosure(false);
  const [title, setTitle] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => recipeApi.create({ title: title.trim(), trip_id: Number(tripId), destination_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] });
      setTitle('');
      setTripId(null);
      close();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => recipeApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] }),
  });

  const list = recipes ?? [];

  return (
    <Container size="lg" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('admin.recipes.title')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          {t('admin.recipes.new')}
        </Button>
      </Group>

      {isLoading ? (
        <Loader />
      ) : list.length === 0 ? (
        <Text c="dimmed">{t('admin.recipes.empty')}</Text>
      ) : (
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('admin.recipes.columns.title')}</Table.Th>
                <Table.Th>{t('admin.recipes.columns.trip')}</Table.Th>
                <Table.Th>{t('admin.recipes.columns.langs')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((recipe) => (
                <Table.Tr key={recipe.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/admin/recettes/${recipe.id}`} fw={600}>
                      {recipe.title ?? recipe.slug}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{recipe.trip_title}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {recipe.langs.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      ) : (
                        recipe.langs.map((code) => (
                          <Badge key={code} size="sm" variant="light">
                            {t(`common.langNames.${code}`)}
                          </Badge>
                        ))
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (window.confirm(t('admin.recipes.confirmDelete', { title: recipe.title ?? recipe.slug }))) {
                            deleteMutation.mutate(recipe.id);
                          }
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* Creation only asks for what identifies the recipe. The rest — subtitle,
          ingredients, steps, photos — belongs to a language, so it lives in the
          editor where the language tabs are. */}
      <Modal opened={opened} onClose={close} title={t('admin.recipes.new')} centered radius="md">
        <Stack>
          <TextInput
            label={t('admin.recipes.fields.title')}
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            required
            autoFocus
          />
          <Select
            label={t('admin.recipes.fields.trip')}
            data={(trips ?? []).map((trip) => ({ value: String(trip.id), label: trip.title }))}
            value={tripId}
            onChange={setTripId}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t('common.close')}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={title.trim() === '' || tripId === null}
            >
              {t('admin.recipes.create')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
