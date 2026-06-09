import { AppShell, Button, Group, Title } from '@mantine/core';
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

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: (session) => {
      setCsrfToken(null);
      queryClient.setQueryData(SESSION_KEY, session);
      navigate('/admin/login', { replace: true });
    },
  });

  const isActive = (to: string) => (to === '/admin' ? pathname === to : pathname.startsWith(to));
  const navButton = (to: string, label: string) => (
    <Button component={Link} to={to} size="xs" variant={isActive(to) ? 'light' : 'subtle'}>
      {label}
    </Button>
  );

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Title order={4} mr="sm">
              {t('auth.admin.title')}
            </Title>
            {navButton('/admin', t('auth.admin.dashboard'))}
            {navButton('/admin/trips', t('admin.trips.title'))}
          </Group>
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
