import { useSyncExternalStore } from 'react';

import type { Router } from './hashRouter';

/**
 * Id маршрута из текущего hash URL.
 *
 * `router.current()` возвращает строку, поэтому снапшот внешнего стора —
 * примитив, и `useSyncExternalStore` может сравнить его без повторного рендера.
 */
export function useRouteId(router: Router): string {
  return useSyncExternalStore(
    (onRouteChange) => router.onRoute(onRouteChange),
    () => router.current(),
    () => router.current(),
  );
}
