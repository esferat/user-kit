import { useSyncExternalStore } from 'react';

import type { Router } from './hashRouter';

/**
 * Id of the route of the current URL hash.
 *
 * `router.current()` returns a string, so the snapshot of the external store is
 * a primitive and `useSyncExternalStore` can compare it without re-rendering.
 */
export function useRouteId(router: Router): string {
  return useSyncExternalStore(
    (onRouteChange) => router.onRoute(onRouteChange),
    () => router.current(),
    () => router.current(),
  );
}
