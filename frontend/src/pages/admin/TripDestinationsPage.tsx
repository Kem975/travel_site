import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIcon, Anchor, Badge, Button, Container, Group, Loader, Table, Text, Title } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconEdit, IconFileText, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi, type Destination } from '../../api/admin';
import { DestinationFormModal } from '../../components/admin/DestinationFormModal';
import { destStatusColor } from '../../components/admin/status';

export function TripDestinationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { tripId: tripIdParam } = useParams();
  const tripId = Number(tripIdParam);
  const valid = Number.isFinite(tripId);

  const tripQuery = useQuery({ queryKey: ['admin', 'trip', tripId], queryFn: () => adminApi.getTrip(tripId), enabled: valid });
  const destQuery = useQuery({
    queryKey: ['admin', 'destinations', tripId],
    queryFn: () => adminApi.listDestinations(tripId),
    enabled: valid,
  });

  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Destination | null>(null);

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => adminApi.reorderDestinations(tripId, ids),
    onSuccess: (destinations) => queryClient.setQueryData(['admin', 'destinations', tripId], destinations),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteDestination(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'destinations', tripId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const list = destQuery.data ?? [];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) {
      return;
    }
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next.map((d) => d.id));
  };

  const openNew = () => {
    setEditing(null);
    open();
  };
  const openEdit = (destination: Destination) => {
    setEditing(destination);
    open();
  };
  const confirmDelete = (destination: Destination) => {
    if (window.confirm(t('admin.destinations.confirmDelete', { title: destination.title }))) {
      deleteMutation.mutate(destination.id);
    }
  };

  return (
    <Container size="lg" py="md">
      <Anchor component={Link} to="/admin/pays" size="sm">
        ← {t('admin.trips.title')}
      </Anchor>
      <Group justify="space-between" mt="xs" mb="lg">
        <div>
          <Title order={2}>{tripQuery.data?.title ?? '…'}</Title>
          <Text c="dimmed" size="sm">
            {t('admin.destinations.title')}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew} disabled={!valid}>
          {t('admin.destinations.new')}
        </Button>
      </Group>

      {destQuery.isLoading ? (
        <Loader />
      ) : list.length > 0 ? (
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
            <Table.Tr>
              <Table.Th w={90}>{t('admin.destinations.order')}</Table.Th>
              <Table.Th>{t('admin.fields.title')}</Table.Th>
              <Table.Th>{t('admin.fields.country')}</Table.Th>
              <Table.Th>{t('admin.fields.coords')}</Table.Th>
              <Table.Th>{t('admin.fields.status')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.map((destination, index) => (
              <Table.Tr key={destination.id}>
                <Table.Td>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => move(index, -1)}
                      aria-label={t('common.moveUp')}
                    >
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={index === list.length - 1 || reorderMutation.isPending}
                      onClick={() => move(index, 1)}
                      aria-label={t('common.moveDown')}
                    >
                      <IconArrowDown size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={600}>{destination.title}</Text>
                  <Text size="xs" c="dimmed">
                    /{destination.slug}
                  </Text>
                </Table.Td>
                <Table.Td>{destination.country ?? '—'}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {destination.latitude && destination.longitude
                      ? `${destination.latitude}, ${destination.longitude}`
                      : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={destStatusColor(destination.status)} variant="light">
                    {t(`admin.destStatus.${destination.status}`)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      component={Link}
                      to={`/admin/destinations/${destination.id}/article`}
                      title={t('article.edit')}
                      aria-label={t('article.edit')}
                    >
                      <IconFileText size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" aria-label={t('common.edit')} onClick={() => openEdit(destination)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => confirmDelete(destination)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Text c="dimmed">{t('admin.destinations.empty')}</Text>
      )}

      {valid && (
        <DestinationFormModal
          opened={opened}
          onClose={close}
          tripId={tripId}
          tripTitle={tripQuery.data?.title ?? ''}
          destination={editing}
        />
      )}
    </Container>
  );
}
