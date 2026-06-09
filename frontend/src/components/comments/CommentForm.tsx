import { useState } from 'react';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { publicCommentApi } from '../../api/comments';
import { ApiError, fieldErrors } from '../../api/client';

type Props = { slug: string; formToken: string; parentId?: number; onPosted: () => void };

type Values = { author_name: string; author_email: string; body: string; website: string };

export function CommentForm({ slug, formToken, parentId, onPosted }: Props) {
  const { t } = useTranslation();
  const form = useForm<Values>({ initialValues: { author_name: '', author_email: '', body: '', website: '' } });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      publicCommentApi.post(slug, {
        author_name: values.author_name,
        author_email: values.author_email || undefined,
        body: values.body,
        website: values.website,
        form_token: formToken,
        parent_id: parentId,
      }),
    onSuccess: (res) => {
      form.reset();
      setError(null);
      setPending(res.status === 'pending');
      onPosted(); // refetch thread → fresh form token (+ shows it if auto-approved)
    },
    onError: (e) => {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length > 0) {
        form.setErrors(fe);
        setError(null);
      } else {
        setError(e instanceof ApiError ? e.message : t('comments.error'));
      }
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack gap="xs">
        {pending && (
          <Alert color="teal" variant="light">
            {t('comments.pending')}
          </Alert>
        )}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group grow>
          <TextInput placeholder={t('comments.name')} required {...form.getInputProps('author_name')} />
          <TextInput placeholder={t('comments.email')} {...form.getInputProps('author_email')} />
        </Group>
        <Textarea placeholder={t('comments.body')} autosize minRows={2} required {...form.getInputProps('body')} />

        {/* Honeypot — hidden from humans, tempting to bots. */}
        <TextInput
          {...form.getInputProps('website')}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        />

        <Group justify="flex-end">
          <Button type="submit" size="xs" loading={mutation.isPending}>
            {parentId ? t('comments.reply') : t('comments.submit')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
