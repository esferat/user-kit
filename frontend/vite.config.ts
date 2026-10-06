import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/odata': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    server: {
      deps: {
        // Каждый пакет UI5 должен проходить через Vite. Коллекция иконок импортирует
        // свой JSON динамически, который Node не может загрузить без атрибута import,
        // а пакет, который Node загружает сам, получил бы вторую копию реестра
        // иконок, и его компоненты сообщали бы об отсутствии коллекции иконок.
        inline: [/@ui5\/webcomponents/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
