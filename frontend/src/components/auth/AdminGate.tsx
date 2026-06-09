import type { ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { Navigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

// Admin routes require an admin-scope session (separate from the visitor gate, plan §15.2).
export function AdminGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <Center style={{ minHeight: '100dvh' }}>
        <Loader />
      </Center>
    );
  }
  if (data?.scope !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
