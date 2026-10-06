export interface RouteTarget {
  id: string;
  params: Record<string, string>;
}

export interface Router {
  start(): void;
  stop(): void;
  current(): string;
  navigate(id: string, params?: Record<string, string>): void;
  onRoute(listener: (route: RouteTarget) => void): () => void;
}

/**
 * Роутер на основе hash: `#/documents`, `#/documents/42`.
 * Сознательно без зависимостей — в приложении три маршрута.
 */
export function createRouter(windowRef: Window = window): Router {
  const listeners = new Set<(route: RouteTarget) => void>();
  let currentRoute = '';
  /** Hash, записанный через `navigate`, чтобы событие браузера не срабатывало дважды. */
  let pendingHash: string | null = null;

  function parse(hash: string): RouteTarget {
    const path = hash.replace(/^#\/?/, '');
    const [id = '', ...rest] = path.split('/').filter((segment) => segment !== '');
    const params: Record<string, string> = {};
    rest.forEach((segment, index) => {
      if (index % 2 === 0) {
        params[segment] = rest[index + 1] ?? '';
      }
    });
    return { id, params };
  }

  function emit(): void {
    const route = parse(windowRef.location.hash);
    currentRoute = route.id;
    listeners.forEach((listener) => listener(route));
  }

  const onHashChange = (): void => {
    if (pendingHash !== null && pendingHash === windowRef.location.hash) {
      pendingHash = null;
      return;
    }
    pendingHash = null;
    emit();
  };

  return {
    start(): void {
      windowRef.addEventListener('hashchange', onHashChange);
      emit();
    },
    stop(): void {
      windowRef.removeEventListener('hashchange', onHashChange);
    },
    current(): string {
      return currentRoute;
    },
    navigate(id: string, params: Record<string, string> = {}): void {
      const suffix = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}/${encodeURIComponent(value)}`)
        .join('/');
      const tail = suffix === '' ? '' : '/' + suffix;
      const nextHash = `#/${id}${tail}`;
      if (windowRef.location.hash === nextHash) {
        emit();
        return;
      }
      pendingHash = nextHash;
      windowRef.location.hash = nextHash;
      emit();
    },
    onRoute(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
