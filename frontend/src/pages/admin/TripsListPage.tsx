import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIcon, Anchor, Badge, Button, Container, Group, Loader, Table, Text, Title } from '@mantine/core';
import { IconEdit, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi, type Trip } from '../../api/admin';
import { TripFormModal } from '../../components/admin/TripFormModal';
import { tripStatusColor } from '../../components/admin/status';

export function TripsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: trips, isLoading } = useQuery({ queryKey: ['admin', 'trips'], queryFn: adminApi.listTrips });
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const openNew = () => {
    setEditing(null);
    open();
  };
  const openEdit = (trip: Trip) => {
    setEditing(trip);
    open();
  };
  const confirmDelete = (trip: Trip) => {
    if (window.confirm(t('admin.trips.confirmDelete', { title: trip.title }))) {
      deleteMutation.mutate(trip.id);
    }
  };

  return (
    <Container size="lg" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('admin.trips.title')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
          {t('admin.trips.new')}
        </Button>
      </Group>

      {isLoading ? (
        <Loader />
      ) : trips && trips.length > 0 ? (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.fields.title')}</Table.Th>
              <Table.Th>{t('admin.fields.status')}</Table.Th>
              <Table.Th>{t('admin.fields.dates')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {trips.map((trip) => (
              <Table.Tr key={trip.id}>
                <Table.Td>
                  <Anchor component={Link} to={`/admin/trips/${trip.id}`} fw={600}>
                    {trip.title}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    /{trip.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={tripStatusColor(trip.status)} variant="light">
                    {t(`admin.tripStatus.${trip.status}`)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {(trip.start_date ?? '—') + ' → ' + (trip.end_date ?? '—')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      component={Link}
                      to={`/admin/trips/${trip.id}`}
                      title={t('admin.trips.manageDestinations')}
                    >
                      <IconMapPin size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" onClick={() => openEdit(trip)} title={t('admin.trips.edit')}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(trip)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed">{t('admin.trips.empty')}</Text>
      )}

      <TripFormModal opened={opened} onClose={close} trip={editing} />
    </Container>
  );
}
