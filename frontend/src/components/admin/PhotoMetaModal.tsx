import { useEffect } from 'react';
import { Button, Group, Image, Modal, Select, Stack, Switch, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { mediaApi, PHOTO_CATEGORIES, type Photo } from '../../api/media';

type Props = { opened: boolean; onClose: () => void; photo: Photo | null };

type FormValues = { alt_text: string; caption: string; category: string; is_featured: boolean };

const EMPTY: FormValues = { alt_text: '', caption: '', category: '', is_featured: false };

export function PhotoMetaModal({ opened, onClose, photo }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ initialValues: EMPTY });

  useEffect(() => {
    if (opened && photo) {
      form.setValues({
        alt_text: photo.alt_text ?? '',
        caption: photo.caption ?? '',
        category: photo.category ?? '',
        is_featured: photo.is_featured,
      });
    }
  }, [opened, photo]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      mediaApi.update(photo!.id, {
        alt_text: values.alt_text,
        caption: values.caption,
        category: values.category === '' ? null : values.category,
        is_featured: values.is_featured,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
      onClose();
    },
  });

  const categoryData = [
    { value: '', label: t('media.categories.none') },
    ...PHOTO_CATEGORIES.map((c) => ({ value: c, label: t(`media.categories.${c}`) })),
  ];

  return (
    <Modal opened={opened} onClose={onClose} title={t('media.edit.title')} centered>
      {photo && (
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack>
            <Image src={photo.thumb ?? undefined} alt={photo.alt_text ?? ''} radius="sm" mah={180} fit="contain" />
            <TextInput label={t('media.fields.caption')} {...form.getInputProps('caption')} />
            <TextInput label={t('media.fields.altText')} {...form.getInputProps('alt_text')} />
            <Select
              label={t('media.fields.category')}
              data={categoryData}
              value={form.values.category}
              onChange={(value) => form.setFieldValue('category', value ?? '')}
            />
            <Switch
              label={t('media.fields.featured')}
              checked={form.values.is_featured}
              onChange={(event) => form.setFieldValue('is_featured', event.currentTarget.checked)}
            />
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
      )}
    </Modal>
  );
}
