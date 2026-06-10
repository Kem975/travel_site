import { lazy, Suspense, type ReactElement } from 'react';
import { Center, Loader } from '@mantine/core';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../components/layout/RootLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
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
const MediaLibraryPage = lazy(() =>
  import('../pages/admin/MediaLibraryPage').then((m) => ({ default: m.MediaLibraryPage })),
);
const ArticleEditorPage = lazy(() =>
  import('../pages/admin/ArticleEditorPage').then((m) => ({ default: m.ArticleEditorPage })),
);
const DestinationPage = lazy(() => import('../pages/DestinationPage').then((m) => ({ default: m.DestinationPage })));
const CommentsPage = lazy(() => import('../pages/admin/CommentsPage').then((m) => ({ default: m.CommentsPage })));
const JournalPage = lazy(() => import('../pages/JournalPage').then((m) => ({ default: m.JournalPage })));
const GalleryPage = lazy(() => import('../pages/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const TripOverviewPage = lazy(() => import('../pages/TripOverviewPage').then((m) => ({ default: m.TripOverviewPage })));
const AboutPage = lazy(() => import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const GlobePrototypePage = lazy(() =>
  import('../pages/GlobePrototypePage').then((m) => ({ default: m.GlobePrototypePage })),
);

const page = (element: ReactElement) => <Suspense fallback={fallback}>{element}</Suspense>;

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
    children: [
      { index: true, element: <HomePage /> },
      { path: 'journal', element: page(<JournalPage />) },
      { path: 'gallery', element: page(<GalleryPage />) },
      { path: 'about', element: page(<AboutPage />) },
      { path: 'globe-prototype', element: page(<GlobePrototypePage />) },
      { path: 'trips/:tripSlug', element: page(<TripOverviewPage />) },
      { path: 'trips/:tripSlug/:destinationSlug', element: page(<DestinationPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
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
      { path: 'destinations/:destinationId/article', element: <ArticleEditorPage /> },
      { path: 'media', element: <MediaLibraryPage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
