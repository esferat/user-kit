import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

import type { AppConfig } from '@/shared/config';

import { readConfig } from '@/shared/config';
import { i18n } from '@/shared/i18n';

const ADMIN = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

const USER = { ...ADMIN, username: 'bob', displayName: 'Bob Roe', email: 'bob@user-kit.local', roles: ['user'] };

const CONFIG: AppConfig = readConfig({});

/**
 * The cookie session would need a running backend for every call, so the provider
 * and the list endpoints are replaced. Everything around them - the session, the
 * router, the shell and the pages - is the real composition.
 */
const fakes = vi.hoisted(() => {
  const listeners = new Set<(user: unknown) => void>();
  return {
    user: null as unknown,
    auth: {
      mode: vi.fn(async (): Promise<'oidc'> => 'oidc'),
      restore: vi.fn(async () => fakes.user),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => {
        fakes.user = null;
        listeners.forEach((listener) => listener(null));
      }),
      onAuthenticated: vi.fn((listener: (user: unknown) => void) => {
        listeners.add(listener);
        listener(fakes.user);
        return () => {
          listeners.delete(listener);
        };
      }),
    },
    fileApi: {
      list: vi.fn(async () => ({ value: [], count: 0 })),
      upload: vi.fn(async () => undefined),
      downloadContent: vi.fn(async () => new Blob()),
      remove: vi.fn(async () => undefined),
    },
    userApi: {
      me: vi.fn(async () => ({})),
      list: vi.fn(async () => ({ value: [], count: 0 })),
      updateRoles: vi.fn(async () => ({})),
    },
  };
});

vi.mock('@/features/auth/model/createAuthProvider', () => ({ createAuthProvider: () => fakes.auth }));
vi.mock('@/entities/file/api/fileApi', () => ({ createFileApi: () => fakes.fileApi }));
vi.mock('@/entities/user/api/userApi', () => ({ createUserApi: () => fakes.userApi }));

function startApp(user: typeof ADMIN | null) {
  fakes.user = user;
  return render(<App config={CONFIG} />);
}

function title(container: HTMLElement): string | undefined {
  return container.querySelector('.page-title')?.textContent ?? undefined;
}

function shell(container: HTMLElement): boolean {
  return container.querySelector('.app-shell') !== null;
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '';
  window.localStorage.clear();
  fakes.user = null;
});

describe('App', () => {
  it('shows the login screen while nobody is authenticated', async () => {
    const { container } = startApp(null);

    await waitFor(() => expect(container.querySelector('.login-page')).not.toBeNull());
    expect(shell(container)).toBe(false);
  });

  it('never shows the login screen of an authenticated user', async () => {
    window.location.hash = '#/documents';

    const { container } = startApp(ADMIN);

    await waitFor(() => expect(shell(container)).toBe(true));
    expect(container.querySelector('.login-page')).toBeNull();
  });

  it('shows the documents page of the signed in user', async () => {
    window.location.hash = '#/documents';

    const { container } = startApp(ADMIN);

    await waitFor(() => expect(shell(container)).toBe(true));
    await waitFor(() => expect(title(container)).toBe(i18n.t('documents.title')));
    expect(fakes.fileApi.list).toHaveBeenCalledOnce();
    expect(fakes.userApi.list).not.toHaveBeenCalled();
  });

  it('routes to the administration page of an admin', async () => {
    window.location.hash = '#/admin-users';

    const { container } = startApp(ADMIN);

    await waitFor(() => expect(title(container)).toBe(i18n.t('users.title')));
    expect(fakes.userApi.list).toHaveBeenCalledOnce();
  });

  it('keeps a plain user out of the administration page', async () => {
    window.location.hash = '#/admin-users';

    const { container } = startApp(USER);

    await waitFor(() => expect(title(container)).toBe(i18n.t('documents.title')));
    expect(container.querySelectorAll('.ant-menu-item')).toHaveLength(1);
    expect(fakes.userApi.list).not.toHaveBeenCalled();
  });

  it('falls back to the documents page of an unknown hash', async () => {
    window.location.hash = '#/nowhere';

    const { container } = startApp(ADMIN);

    await waitFor(() => expect(title(container)).toBe(i18n.t('documents.title')));
  });

  it('follows the hash of the browser', async () => {
    window.location.hash = '#/documents';
    const { container } = startApp(ADMIN);
    await waitFor(() => expect(title(container)).toBe(i18n.t('documents.title')));

    window.location.hash = '#/admin-users';
    fireEvent(window, new HashChangeEvent('hashchange'));

    await waitFor(() => expect(title(container)).toBe(i18n.t('users.title')));
  });

  it('shows the login screen again after the sign out', async () => {
    window.location.hash = '#/documents';
    const { container } = startApp(ADMIN);
    await waitFor(() => expect(shell(container)).toBe(true));

    fireEvent.click(container.querySelector('.ant-avatar') as Element);
    const items = await waitFor(() => {
      const found = [...document.querySelectorAll('.ant-dropdown-menu-item')];
      expect(found).toHaveLength(2);
      return found;
    });
    fireEvent.click(items[1]);

    await waitFor(() => expect(fakes.auth.logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(container.querySelector('.login-page')).not.toBeNull());
    expect(shell(container)).toBe(false);
  });

  it('restores the session of the provider on start', async () => {
    startApp(USER);

    await waitFor(() => expect(fakes.auth.restore).toHaveBeenCalled());
  });

  it('applies the theme of the configuration and the interface language', async () => {
    startApp(USER);

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.lang).toBe('ru');
  });

  it('feeds the Ant Design provider with the stored dark theme', async () => {
    window.localStorage.setItem('user-kit-antd:theme', 'dark');

    const { container } = startApp(USER);

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    // The dark algorithm paints its background into the config provider.
    expect(container.querySelector('.app-shell')).not.toBeNull();
  });

  it('stops the router of an unmounted application', async () => {
    const { unmount } = startApp(ADMIN);
    await waitFor(() => expect(fakes.auth.restore).toHaveBeenCalled());

    unmount();

    // Without the listener the hash change of the browser stays unnoticed.
    expect(() => {
      window.location.hash = '#/admin-users';
      fireEvent(window, new HashChangeEvent('hashchange'));
    }).not.toThrow();
  });
});
