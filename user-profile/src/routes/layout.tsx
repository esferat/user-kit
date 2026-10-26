import { Helmet } from '@modern-js/runtime/head';
import { Outlet } from '@modern-js/runtime/router';

import { AppProviders } from '@shared/ui';

import './index.css';

/**
 * Оболочка всех страниц этого сервиса. Провайдеры здесь — для локальных
 * роутов; та же форма, вставленная во frontend-main, привозит свои.
 */
export default function Layout() {
  return (
    <AppProviders>
      <Helmet>
        <title>Профиль — user-profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Helmet>
      <main className="page">
        <Outlet />
      </main>
    </AppProviders>
  );
}
