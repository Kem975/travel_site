import { Anchor, AppShell, Box, Burger, Button, Center, Collapse, Divider, Group, Loader, Paper, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { SESSION_KEY, useSession } from '../../hooks/useSession';
import { PasswordGate } from '../auth/PasswordGate';
import { VisitorNamePrompt } from '../auth/VisitorNamePrompt';
import { JourneyTimeline } from '../journey/JourneyTimeline';
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
    ['/recettes', t('nav.recipes')],
    ['/gallery', t('nav.gallery')],
    ['/about', t('nav.about')],
  ];

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)' }}>
        {/* Grid, not space-between: the nav and the toggles have different widths, so
            only equal side columns put the timeline in the middle of the header. */}
        <Box
          h="100%"
          px="lg"
          style={{
            display: 'grid',
            // minmax(0, 1fr) rather than 1fr: a bare 1fr floors at the content's
            // own width, so the wordmark and the toggles pushed the strip out of
            // the header instead of letting it shrink.
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 'var(--mantine-spacing-sm)',
          }}
        >
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger opened={menuOpened} onClick={toggleMenu} hiddenFrom="md" size="sm" aria-label={t('nav.menu')} />
            <Anchor component={Link} to="/" underline="never" c="inherit" onClick={closeMenu}>
              <Title order={4} style={{ whiteSpace: 'nowrap' }}>
                {t('app.title')}
              </Title>
            </Anchor>
            <Group gap={4} visibleFrom="md">
              {navItems.map(([to, label]) => (
                <Button key={to} component={Link} to={to} size="xs" variant={pathname === to ? 'light' : 'subtle'}>
                  {label}
                </Button>
              ))}
            </Group>
          </Group>
          {/* Wrapper holds the middle column open even when the timeline renders nothing. */}
          <Box style={{ minWidth: 0 }}>
            <JourneyTimeline />
          </Box>
          <Group gap="sm" wrap="nowrap" justify="flex-end">
            <LanguageToggle />
            <ColorSchemeToggle />
            <Button
              visibleFrom="md"
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => logoutMutation.mutate()}
              loading={logoutMutation.isPending}
            >
              {t('auth.logout')}
            </Button>
          </Group>
        </Box>
      </AppShell.Header>

      {/* Lightweight mobile menu (no Modal/Drawer weight). */}
      <Box hiddenFrom="md" style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200 }}>
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

      <VisitorNamePrompt />
    </AppShell>
  );
}
