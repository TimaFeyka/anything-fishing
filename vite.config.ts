import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

// Frontend живёт в web/, собирается в dist/public и раздаётся тем же Node-сервером,
// поэтому на Render достаточно одного Web Service (плюс Postgres).
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // Общая физика вываживания: один источник правды для сервера и клиента.
      '@shared/physics': here + 'server/src/physics.ts',
    },
  },
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
});

