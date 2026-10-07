import { beforeEach, describe, expect, it } from 'vitest';

import { createRouter } from './hashRouter';

beforeEach(() => {
  window.location.hash = '';
});

describe('createRouter', () => {
  it('parses the initial route on start', () => {
    const router = createRouter();
    const routes: string[] = [];
    router.onRoute((route) => routes.push(route.id));

    router.start();
    router.stop();

    expect(routes).toEqual(['']);
    expect(router.current()).toBe('');
  });

  it('navigates and notifies listeners', () => {
    const router = createRouter();
    const routes: string[] = [];
    router.onRoute((route) => routes.push(route.id));
    router.start();

    router.navigate('documents');
    expect(window.location.hash).toBe('#/documents');

    router.navigate('admin-users', { userId: 'u 1' });
    expect(window.location.hash).toBe('#/admin-users/userId/u%201');
    expect(routes).toContain('admin-users');
    router.stop();
  });

  it('passes path parameters to the listener', () => {
    const router = createRouter();
    const received: Array<Record<string, string>> = [];
    router.onRoute((route) => received.push(route.params));
    router.start();

    router.navigate('documents', { id: '42' });

    expect(received.at(-1)).toEqual({ id: '42' });
    router.stop();
  });

  it('unsubscribes listeners', () => {
    const router = createRouter();
    let calls = 0;
    const unsubscribe = router.onRoute(() => {
      calls += 1;
    });
    router.start();
    const afterFirst = calls;

    unsubscribe();
    router.navigate('documents');

    expect(calls).toBe(afterFirst);
    router.stop();
  });
});
