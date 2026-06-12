import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Center, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { visitorLogin } from '../../api/auth';
import { ApiError, setCsrfToken } from '../../api/client';
import { SESSION_KEY } from '../../hooks/useSession';
import { LanguageToggle } from '../layout/LanguageToggle';
import { LazyGlobe } from '../globe/LazyGlobe';

// Signature landing: the rotating globe sits behind the shared-password form.
// A decorative globe only (no destinations) — the real route is never exposed
// before authentication. The form is usable instantly; the globe fades in.
export function PasswordGate() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => visitorLogin(password),
    onSuccess: (session) => {
      setCsrfToken(session.csrf_token);
      queryClient.setQueryData(SESSION_KEY, session);
    },
  });

  const errorMessage = mutation.isError
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : t('auth.gate.genericError')
    : null;

  return (
    <Box style={{ position: 'relative', minHeight: '100dvh', background: 'linear-gradient(160deg,#0b1d2a,#13303f 55%,#1c4351)' }}>
      <Box style={{ position: 'absolute', inset: 0 }}>
        <LazyGlobe trips={[]} interactive={false} stylePreset="atlas" />
      </Box>
      <Box style={{ position: 'absolute', inset: 0, background: 'rgba(4,12,20,0.45)', backdropFilter: 'blur(2px)' }} />

      <Box style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
        <LanguageToggle />
      </Box>

      <Center style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: 16 }}>
        <Paper radius="lg" p="xl" shadow="xl" w={420} maw="100%">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Stack>
              <div>
                <Title order={2}>{t('app.title')}</Title>
                <Text c="dimmed" size="sm" mt={4}>
                  {t('app.subtitle')}
                </Text>
              </div>

              {errorMessage && (
                <Alert color="red" variant="light">
                  {errorMessage}
                </Alert>
              )}

              <PasswordInput
                label={t('auth.gate.label')}
                placeholder={t('auth.gate.placeholder')}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                size="md"
                autoFocus
                required
              />

              <Button type="submit" size="md" loading={mutation.isPending} disabled={password === ''}>
                {t('auth.gate.button')}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Center>
    </Box>
  );
}
