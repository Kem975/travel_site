import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { setVisitorName, type Session } from '../../api/auth';
import { SESSION_KEY, useSession } from '../../hooks/useSession';

// Asked after the gate rather than on it: the shared password should stay the
// only thing between a guest and the site.
const SKIPPED = 'visitor-name-skipped';

export function VisitorNamePrompt() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useSession();
  const [name, setName] = useState('');
  const [skipped, setSkipped] = useState(() => localStorage.getItem(SKIPPED) === '1');

  const mutation = useMutation({
    mutationFn: () => setVisitorName(name.trim()),
    onSuccess: ({ visitor_name }) => {
      queryClient.setQueryData<Session>(SESSION_KEY, (session) =>
        session ? { ...session, visitor_name } : session,
      );
    },
  });

  const skip = () => {
    localStorage.setItem(SKIPPED, '1');
    setSkipped(true);
  };

  const open = data?.scope === 'visitor' && data.visitor_name === null && !skipped;

  return (
    <Modal opened={open} onClose={skip} title={t('auth.name.title')} centered radius="md">
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
            autoFocus
          />
          <Group justify="space-between">
            <Button variant="subtle" color="gray" onClick={skip}>
              {t('auth.name.skip')}
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={name.trim() === ''}>
              {t('auth.name.submit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
