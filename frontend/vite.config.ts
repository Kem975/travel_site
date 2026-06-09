import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-origin in production (SPA + /api on the same OVH domain), so dev simply
// proxies /api to the local PHP server to mirror that — no CORS anywhere.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Uploaded media is served by the PHP front controller in dev (Apache in prod).
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
