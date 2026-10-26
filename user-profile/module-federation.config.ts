import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

// Микрофронтенд выступает производителем (remote): отдаёт форму правки профиля
// и манифест со статикой. Потребитель — frontend-main, он подключает remote
// через @module-federation/runtime, собственного плагина у Next.js нет.
export default createModuleFederationConfig({
  name: 'user_profile',
  manifest: {
    filePath: 'static',
  },
  filename: 'static/remoteEntry.js',
  exposes: {
    './ProfileEdit': './src/features/profile-edit/index.tsx',
  },
  shared: {
    react: { singleton: true, requiredVersion: false },
    'react-dom': { singleton: true, requiredVersion: false },
    antd: { singleton: true, requiredVersion: false },
  },
});
