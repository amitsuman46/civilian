import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '..',
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@maptiler/leaflet-maptilersdk',
      '@maptiler/sdk',
    ],
  },
  server: {
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true, credentials: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
