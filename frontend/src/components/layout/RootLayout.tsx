import { Anchor, AppShell, Box, Burger, Button, Center, Collapse, Divider, Group, Loader, Paper, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
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
  const [menuOpened, { toggle: toggleMenu, close: closeMenu }] = useDisclosure(false);

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
  if (!data?.authenticated) {
    return <PasswordGate />;
  }

  const navItems: [string, string][] = [
    ['/journal', t('nav.journal')],
    ['/gallery', t('nav.gallery')],
    ['/about', t('nav.about')],
  ];

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)' }}>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={menuOpened} onClick={toggleMenu} hiddenFrom="sm" size="sm" aria-label={t('nav.menu')} />
            <Anchor component={Link} to="/" underline="never" c="inherit" onClick={closeMenu}>
              <Title order={4}>{t('app.title')}</Title>
            </Anchor>
            <Group gap={4} visibleFrom="sm">
              {navItems.map(([to, label]) => (
                <Button key={to} component={Link} to={to} size="xs" variant={pathname === to ? 'light' : 'subtle'}>
                  {label}
                </Button>
              ))}
            </Group>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <LanguageToggle />
            <ColorSchemeToggle />
            <Button
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => logoutMutation.mutate()}
              loading={logoutMutation.isPending}
            >
              {t('auth.logout')}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Lightweight mobile menu (no Modal/Drawer weight). */}
      <Box hiddenFrom="sm" style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200 }}>
        <Collapse in={menuOpened}>
          <Paper shadow="md" radius={0} p="sm" withBorder>
            <Stack gap="xs">
              {navItems.map(([to, label]) => (
                <Button
                  key={to}
                  component={Link}
                  to={to}
                  variant={pathname === to ? 'light' : 'subtle'}
                  justify="flex-start"
                  onClick={closeMenu}
                >
                  {label}
                </Button>
              ))}
              <Divider my={4} />
              <Button
                variant="default"
                justify="flex-start"
                onClick={() => {
                  closeMenu();
                  logoutMutation.mutate();
                }}
              >
                {t('auth.logout')}
              </Button>
            </Stack>
          </Paper>
        </Collapse>
      </Box>

      <AppShell.Main className="public-shell">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
