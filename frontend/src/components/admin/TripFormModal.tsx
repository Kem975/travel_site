import { useEffect } from 'react';
import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminApi, type Trip, type TripInput, type TripStatus, type Visibility } from '../../api/admin';
import { fieldErrors } from '../../api/client';
import { TRIP_STATUSES, VISIBILITIES } from './status';

type Props = { opened: boolean; onClose: () => void; trip: Trip | null };

const EMPTY: TripInput = {
  title: '',
  slug: '',
  description: '',
  start_date: '',
  end_date: '',
  status: 'draft',
  visibility: 'password_protected',
};

export function TripFormModal({ opened, onClose, trip }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<TripInput>({ initialValues: EMPTY });

  useEffect(() => {
    if (!opened) {
      return;
    }
    form.setValues(
      trip
        ? {
            title: trip.title,
            slug: trip.slug,
            description: trip.description ?? '',
            start_date: trip.start_date ?? '',
            end_date: trip.end_date ?? '',
            status: trip.status,
            visibility: trip.visibility,
          }
        : EMPTY,
    );
    form.clearErrors();
  }, [opened, trip]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (values: TripInput) => (trip ? adminApi.updateTrip(trip.id, values) : adminApi.createTrip(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] });
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

  const statusData = TRIP_STATUSES.map((s) => ({ value: s, label: t(`admin.tripStatus.${s}`) }));
  const visibilityData = VISIBILITIES.map((v) => ({ value: v, label: t(`admin.visibility.${v}`) }));

  return (
    <Modal opened={opened} onClose={onClose} title={trip ? t('admin.trips.edit') : t('admin.trips.new')} centered>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label={t('admin.fields.title')} required {...form.getInputProps('title')} />
          <TextInput
            label={t('admin.fields.slug')}
            placeholder={t('admin.fields.slugPlaceholder')}
            {...form.getInputProps('slug')}
          />
          <Textarea label={t('admin.fields.description')} autosize minRows={2} {...form.getInputProps('description')} />
          <Group grow>
            <TextInput type="date" label={t('admin.fields.startDate')} {...form.getInputProps('start_date')} />
            <TextInput type="date" label={t('admin.fields.endDate')} {...form.getInputProps('end_date')} />
          </Group>
          <Group grow>
            <Select
              label={t('admin.fields.status')}
              data={statusData}
              allowDeselect={false}
              value={form.values.status}
              error={form.errors.status}
              onChange={(value) => form.setFieldValue('status', (value as TripStatus | null) ?? 'draft')}
            />
            <Select
              label={t('admin.fields.visibility')}
              data={visibilityData}
              allowDeselect={false}
              value={form.values.visibility}
              error={form.errors.visibility}
              onChange={(value) => form.setFieldValue('visibility', (value as Visibility | null) ?? 'password_protected')}
            />
          </Group>
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
