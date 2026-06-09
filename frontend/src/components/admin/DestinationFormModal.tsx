import { useEffect } from 'react';
import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminApi, type Destination, type DestinationInput, type DestinationStatus } from '../../api/admin';
import { fieldErrors } from '../../api/client';
import { DESTINATION_STATUSES } from './status';

type Props = { opened: boolean; onClose: () => void; tripId: number; destination: Destination | null };

const EMPTY: DestinationInput = {
  title: '',
  slug: '',
  country: '',
  latitude: '',
  longitude: '',
  arrival_date: '',
  departure_date: '',
  excerpt: '',
  status: 'planned',
};

export function DestinationFormModal({ opened, onClose, tripId, destination }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<DestinationInput>({ initialValues: EMPTY });

  useEffect(() => {
    if (!opened) {
      return;
    }
    form.setValues(
      destination
        ? {
            title: destination.title,
            slug: destination.slug,
            country: destination.country ?? '',
            latitude: destination.latitude ?? '',
            longitude: destination.longitude ?? '',
            arrival_date: destination.arrival_date ?? '',
            departure_date: destination.departure_date ?? '',
            excerpt: destination.excerpt ?? '',
            status: destination.status,
          }
        : EMPTY,
    );
    form.clearErrors();
  }, [opened, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (values: DestinationInput) =>
      destination ? adminApi.updateDestination(destination.id, values) : adminApi.createDestination(tripId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'destinations', tripId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      onClose();
    },
    onError: (error) => {
      const errors = fieldErrors(error);
      if (Object.keys(errors).length > 0) {
        form.setErrors(errors);
      }
    },
  });

  const statusData = DESTINATION_STATUSES.map((s) => ({ value: s, label: t(`admin.destStatus.${s}`) }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={destination ? t('admin.destinations.edit') : t('admin.destinations.new')}
      centered
    >
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label={t('admin.fields.title')} required {...form.getInputProps('title')} />
          <Group grow>
            <TextInput label={t('admin.fields.country')} {...form.getInputProps('country')} />
            <TextInput
              label={t('admin.fields.slug')}
              placeholder={t('admin.fields.slugPlaceholder')}
              {...form.getInputProps('slug')}
            />
          </Group>
          <Group grow>
            <TextInput label={t('admin.fields.latitude')} inputMode="decimal" {...form.getInputProps('latitude')} />
            <TextInput label={t('admin.fields.longitude')} inputMode="decimal" {...form.getInputProps('longitude')} />
          </Group>
          <Group grow>
            <TextInput type="date" label={t('admin.fields.arrivalDate')} {...form.getInputProps('arrival_date')} />
            <TextInput type="date" label={t('admin.fields.departureDate')} {...form.getInputProps('departure_date')} />
          </Group>
          <Select
            label={t('admin.fields.status')}
            data={statusData}
            allowDeselect={false}
            value={form.values.status}
            error={form.errors.status}
            onChange={(value) => form.setFieldValue('status', (value as DestinationStatus | null) ?? 'planned')}
          />
          <Textarea label={t('admin.fields.excerpt')} autosize minRows={2} {...form.getInputProps('excerpt')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              {t('admin.actions.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {t('admin.actions.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
