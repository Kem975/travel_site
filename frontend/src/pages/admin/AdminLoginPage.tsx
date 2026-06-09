import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminLogin } from '../../api/auth';
import { ApiError, setCsrfToken } from '../../api/client';
import { SESSION_KEY, useSession } from '../../hooks/useSession';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminLogin(email, password),
    onSuccess: (session) => {
      setCsrfToken(session.csrf_token);
      queryClient.setQueryData(SESSION_KEY, session);
      navigate('/admin', { replace: true });
    },
  });

  if (data?.scope === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const errorMessage = mutation.isError
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : t('auth.gate.genericError')
    : null;

  return (
    <Center style={{ minHeight: '100dvh', padding: 16 }}>
      <Paper radius="lg" p="xl" shadow="md" w={420} maw="100%" withBorder>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Stack>
            <Title order={2}>{t('auth.admin.title')}</Title>

            {errorMessage && (
              <Alert color="red" variant="light">
                {errorMessage}
              </Alert>
            )}

            <TextInput
              label={t('auth.admin.email')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              autoFocus
              required
            />
            <PasswordInput
              label={t('auth.admin.password')}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Button type="submit" loading={mutation.isPending} disabled={email === '' || password === ''}>
              {t('auth.admin.signIn')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
