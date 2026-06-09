import { AppShell, Button, Center, Group, Loader, Title } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { SESSION_KEY, useSession } from '../../hooks/useSession';
import { PasswordGate } from '../auth/PasswordGate';
import { logout as logoutRequest } from '../../api/auth';
import { setCsrfToken } from '../../api/client';

export function RootLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSession();

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: (session) => {
      setCsrfToken(null);
      queryClient.setQueryData(SESSION_KEY, session);
    },
  });

  if (isLoading) {
    return (
      <Center style={{ minHeight: '100dvh' }}>
        <Loader />
      </Center>
    );
  }

  // The whole public site sits behind the shared trip password.
  if (!data?.authenticated) {
    return <PasswordGate />;
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>{t('app.title')}</Title>
          <Group gap="sm">
            <LanguageToggle />
            <ColorSchemeToggle />
            <Button
              variant="default"
              size="xs"
              onClick={() => logoutMutation.mutate()}
              loading={logoutMutation.isPending}
            >
              {t('auth.logout')}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
