import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

/**
 * The dev server runs on :5174 so that the UI5 shell of the same repository can
 * keep :5173. Both proxy to the same backend on :8080.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/odata': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    // The application code is small; only the Ant Design vendor chunk is large and
    // it is cached on its own.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Ant Design is far bigger than the application code, so it is kept in
        // its own chunk and the browser caches it across deploys of the pages.
        manualChunks(id: string): string | undefined {
          return id.includes('node_modules/antd') || id.includes('node_modules/@ant-design') ? 'antd' : undefined;
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
