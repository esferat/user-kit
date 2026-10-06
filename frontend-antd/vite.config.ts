import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

/**
 * Dev-сервер работает на :5174, чтобы UI5-оболочка того же репозитория могла
 * остаться на :5173. Оба настроены через proxy на один и тот же backend на :8080.
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
    // Код приложения небольшой; только vendor-чанк Ant Design крупный,
    // и он кешируется отдельно.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Ant Design значительно больше кода приложения, поэтому он вынесен в
        // отдельный чанк, и браузер кеширует его между выкладками страниц.
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
