import { AppShell, Anchor, Button, Center, Group, Loader, Title } from '@mantine/core';
import { Link, Outlet, useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();

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

  const navLink = (to: string, label: string) => (
    <Button component={Link} to={to} size="xs" variant={pathname === to ? 'light' : 'subtle'}>
      {label}
    </Button>
  );

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Anchor component={Link} to="/" underline="never" c="inherit">
              <Title order={4}>{t('app.title')}</Title>
            </Anchor>
            <Group gap={4} visibleFrom="sm">
              {navLink('/journal', t('nav.journal'))}
              {navLink('/gallery', t('nav.gallery'))}
              {navLink('/about', t('nav.about'))}
            </Group>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <LanguageToggle />
            <ColorSchemeToggle />
            <Button variant="default" size="xs" onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
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
