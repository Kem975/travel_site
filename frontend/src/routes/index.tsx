import { lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../components/layout/RootLayout';
import { HomePage } from '../pages/HomePage';
import { AdminGate } from '../components/auth/AdminGate';

// The admin section is lazy-loaded so visitors never download it (plan §17.2).
const AdminLayout = lazy(() => import('../components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const TripsListPage = lazy(() => import('../pages/admin/TripsListPage').then((m) => ({ default: m.TripsListPage })));
const TripDestinationsPage = lazy(() =>
  import('../pages/admin/TripDestinationsPage').then((m) => ({ default: m.TripDestinationsPage })),
);

const fallback = (
  <Center style={{ minHeight: '100dvh' }}>
    <Loader />
  </Center>
);

// Public site ('/') sits behind the visitor gate (in RootLayout). The /admin
// tree is a separate entrance behind admin-scope auth (plan §15.2).
// Public route groups grow here: /journal, /gallery, /trips/:slug, /about.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={fallback}>
        <AdminLoginPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={fallback}>
        <AdminGate>
          <AdminLayout />
        </AdminGate>
      </Suspense>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'trips', element: <TripsListPage /> },
      { path: 'trips/:tripId', element: <TripDestinationsPage /> },
    ],
  },
]);
