import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
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
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    server: {
      deps: {
        // The UI5 icon collection imports its JSON dynamically. Node would need an
        // import attribute for that, Vite inlines the JSON instead.
        inline: [/@ui5\/webcomponents-icons/, /@ui5\/webcomponents-base/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/vite-env.d.ts'],
    },
  },
});
