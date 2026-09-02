import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { setVisitorName, type Session } from '../../api/auth';
import { SESSION_KEY, useSession } from '../../hooks/useSession';

// Asked after the gate rather than on it: the shared password should stay the only
// thing between a guest and the site. Required, though — the password is shared, so
// the name is the only way to know who is actually reading.
export function VisitorNamePrompt() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useSession();
  const [name, setName] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => setVisitorName(name.trim()),
    onSuccess: ({ visitor_name }) => {
      queryClient.setQueryData<Session>(SESSION_KEY, (session) =>
        session ? { ...session, visitor_name } : session,
      );
      setPrivacyOpen(true);
    },
  });

  const needsName = data?.scope === 'visitor' && data.visitor_name === null;

  return (
    <>
      {/* Every way out is closed — no skip, no cross, no click-away, no Escape — so
          answering is the only exit. Mantine still calls onClose internally, hence
          the no-op rather than a handler that would dismiss it. */}
      <Modal
        opened={needsName}
        onClose={() => undefined}
        title={t('auth.name.title')}
        centered
        radius="md"
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Stack>
            <Text size="sm" c="dimmed">
              {t('auth.name.intro')}
            </Text>
            <TextInput
              label={t('auth.name.label')}
              placeholder={t('auth.name.placeholder')}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={60}
              size="md"
              required
              autoFocus
            />
            <Group justify="flex-end">
              <Button type="submit" loading={mutation.isPending} disabled={name.trim() === ''}>
                {t('auth.name.submit')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Shown once, right as the name lands: `needsName` is false from then on, so
          component state is enough and there is nothing to persist. */}
      <Modal
        opened={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t('auth.privacy.title')}
        centered
        radius="md"
      >
        <Stack>
          <Text size="sm">{t('auth.privacy.body')}</Text>
          <Group justify="flex-end">
            <Button onClick={() => setPrivacyOpen(false)}>{t('auth.privacy.confirm')}</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
