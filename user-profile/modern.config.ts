import { appTools, defineConfig } from '@modern-js/app-tools';
import { bffPlugin } from '@modern-js/plugin-bff';
import { moduleFederationPlugin } from '@module-federation/modern-js-v3';

// Публичный адрес этого микрофронтенда. Из него собираются publicPath внутри
// mf-manifest.json, поэтому в проде он обязан совпадать с доменом в nginx.
const assetPrefix = process.env.PROFILE_ASSET_PREFIX ?? 'https://user-kit.profile.local';

// https://modernjs.dev/en/configure/app/usage
export default defineConfig({
  server: {
    // Внутренний порт контейнера; nginx проксирует на него свой домен.
    port: Number(process.env.PORT ?? 3001),
  },
  bff: {
    // Роуты api/lambda/* публикуются под этим префиксом. Он одинаков и на
    // домене приложения, и на своём домене, чтобы вызывающий код не знал
    // о том, где сервис опубликован.
    prefix: '/profile-api',
  },
  output: {
    assetPrefix,
  },
  plugins: [appTools(), bffPlugin(), moduleFederationPlugin()],
});
