import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRouteId } from './useRoute';

import type { RouteTarget, Router } from './hashRouter';

/** Заглушка роутера с учётом слушателей, как в настоящем hash-роутере. */
function createRouter(initial: string): Router & { emit(routeId: string): void; listeners: number } {
  let current = initial;
  const listeners = new Set<(route: RouteTarget) => void>();
  const router = {
    current: () => current,
    start: vi.fn(),
    stop: vi.fn(),
    navigate: vi.fn(),
    onRoute: (listener: (route: RouteTarget) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(routeId: string) {
      current = routeId;
      listeners.forEach((listener) => listener({ id: routeId, params: {} }));
    },
    get listeners() {
      return listeners.size;
    },
  };
  return router;
}

function Probe({ router }: { router: Router }) {
  return <span data-testid="route">{useRouteId(router)}</span>;
}

function route(): string | null {
  return screen.getByTestId('route').textContent;
}

describe('useRouteId', () => {
  it('reports the route of the moment', () => {
    render(<Probe router={createRouter('documents')} />);

    expect(route()).toBe('documents');
  });

  it('re-renders on every route change', () => {
    const router = createRouter('documents');
    render(<Probe router={router} />);

    act(() => router.emit('admin-users'));
    expect(route()).toBe('admin-users');

    act(() => router.emit('documents'));
    expect(route()).toBe('documents');
  });

  it('drops the listener when the component goes away', () => {
    const router = createRouter('documents');
    const { unmount } = render(<Probe router={router} />);
    expect(router.listeners).toBe(1);

    unmount();
    expect(router.listeners).toBe(0);
  });

  it('ignores a route change that keeps the same id', () => {
    const router = createRouter('documents');
    render(<Probe router={router} />);
    const listener = screen.getByTestId('route');

    act(() => router.emit('documents'));

    expect(listener.isConnected).toBe(true);
    expect(route()).toBe('documents');
  });
});
