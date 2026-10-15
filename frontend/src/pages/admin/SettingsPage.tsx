import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Container, Group, Loader, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { adminApi, type SiteSettings } from '../../api/admin';
import { fieldErrors } from '../../api/client';
import { PlaceSearchField } from '../../components/admin/PlaceSearchField';

const EMPTY: SiteSettings = { departure_name: '', departure_lat: '', departure_lng: '', departure_timezone: '' };

/**
 * Every zone the browser knows. `supportedValuesOf` is recent enough to be worth
 * guarding: without it the field still holds whatever is stored, it just cannot
 * be browsed.
 */
function timezoneOptions(current: string | null): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  if (current && !all.includes(current)) return [current, ...all];
  return all.length > 0 ? all : current ? [current] : [];
}

/**
 * Site settings. One section for now — the departure point — but the endpoint is
 * key-based, so this is where anything else editable lands rather than growing a
 * second settings surface.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminApi.getSettings });

  const form = useForm<SiteSettings>({ initialValues: EMPTY });

  // The form is created before the query resolves, so fill it once the values land.
  // setValues (not setInitialValues alone) so a refetch after saving shows the
  // stored value rather than what was typed.
  useEffect(() => {
    if (data) {
      const values: SiteSettings = {
        departure_name: data.departure_name ?? '',
        departure_lat: data.departure_lat ?? '',
        departure_lng: data.departure_lng ?? '',
        departure_timezone: data.departure_timezone ?? '',
      };
      form.setValues(values);
      form.resetDirty(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values: SiteSettings) => adminApi.updateSettings(values),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin', 'settings'], saved);
      // The globe reads the departure point, so its cached payload is now stale.
      queryClient.invalidateQueries({ queryKey: ['globe'] });
    },
    onError: (error) => {
      const errors = fieldErrors(error);
      if (Object.keys(errors).length > 0) form.setErrors(errors);
    },
  });

  if (isLoading) return <Loader />;

  return (
    <Container size="sm" px={0}>
      <Title order={3} mb="xs">
        {t('admin.settings.title')}
      </Title>

      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack gap="sm">
          <Title order={5} mt="sm">
            {t('admin.settings.departure.title')}
          </Title>
          <Text c="dimmed" size="sm">
            {t('admin.settings.departure.help')}
          </Text>

          <TextInput label={t('admin.settings.departure.name')} {...form.getInputProps('departure_name')} />

          <PlaceSearchField
            label={t('admin.fields.placeSearch')}
            placeholder={t('admin.fields.placeSearchPlaceholder')}
            onPick={(r) => {
              form.setFieldValue('departure_lat', String(r.lat));
              form.setFieldValue('departure_lng', String(r.lng));
              if (!form.values.departure_name) form.setFieldValue('departure_name', r.label);
            }}
          />

          <Group grow>
            <TextInput
              label={t('admin.fields.latitude')}
              inputMode="decimal"
              {...form.getInputProps('departure_lat')}
            />
            <TextInput
              label={t('admin.fields.longitude')}
              inputMode="decimal"
              {...form.getInputProps('departure_lng')}
            />
          </Group>

          <Select
            label={t('admin.settings.departure.timezone')}
            description={t('admin.settings.departure.timezoneHelp')}
            data={timezoneOptions(data?.departure_timezone ?? null)}
            searchable
            nothingFoundMessage={t('admin.settings.departure.timezoneNotFound')}
            {...form.getInputProps('departure_timezone')}
          />

          {mutation.isSuccess && !form.isDirty() && (
            <Alert color="travelTeal" variant="light">
              {t('admin.settings.saved')}
            </Alert>
          )}

          <Group justify="flex-end" mt="sm">
            <Button type="submit" loading={mutation.isPending}>
              {t('admin.actions.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Container>
  );
}
