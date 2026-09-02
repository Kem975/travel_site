import { AppShell, Box, Burger, Button, Collapse, Divider, Group, Paper, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout as logoutRequest } from '../../api/auth';
import { setCsrfToken } from '../../api/client';
import { SESSION_KEY } from '../../hooks/useSession';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LanguageToggle } from './LanguageToggle';

export function AdminLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpened, { toggle: toggleMenu, close: closeMenu }] = useDisclosure(false);

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: (session) => {
      setCsrfToken(null);
      queryClient.setQueryData(SESSION_KEY, session);
      navigate('/admin/login', { replace: true });
    },
  });

  const navItems: [string, string][] = [
    ['/admin', t('auth.admin.dashboard')],
    ['/admin/pays', t('admin.trips.title')],
    ['/admin/recettes', t('admin.recipes.title')],
    ['/admin/media', t('media.nav')],
    ['/admin/comments', t('comments.admin.nav')],
  ];
  const isActive = (to: string) => (to === '/admin' ? pathname === to : pathname.startsWith(to));

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={menuOpened} onClick={toggleMenu} hiddenFrom="sm" size="sm" aria-label={t('nav.menu')} />
            <Title order={4} mr="sm">
              {t('auth.admin.title')}
            </Title>
            <Group gap={4} visibleFrom="sm">
              {navItems.map(([to, label]) => (
                <Button key={to} component={Link} to={to} size="xs" variant={isActive(to) ? 'light' : 'subtle'}>
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

      <Box hiddenFrom="sm" style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200 }}>
        <Collapse in={menuOpened}>
          <Paper shadow="md" radius={0} p="sm" withBorder>
            <Stack gap="xs">
              {navItems.map(([to, label]) => (
                <Button
                  key={to}
                  component={Link}
                  to={to}
                  variant={isActive(to) ? 'light' : 'subtle'}
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

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
