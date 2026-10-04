import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '../model/types';

import { OidcAuthProvider, consumeReturnUrl, saveReturnUrl } from './oidcAuthProvider';

import type { User, UserManager } from 'oidc-client-ts';

import type { OidcConfig } from '@/shared/config';

const RETURN_URL_KEY = 'user-kit:return-url';

const config: OidcConfig = {
  authority: 'https://user-kit.local/auth/realms/user-kit',
  clientId: 'user-kit-web',
  redirectUri: 'https://user-kit.local/',
  postLogoutRedirectUri: 'https://user-kit.local/',
  scope: 'openid profile email',
  rolesClaim: '',
};

function user(overrides: Partial<User> = {}): User {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expired: false,
    profile: {
      sub: 'oidc-1',
      preferred_username: 'jane',
      name: 'Jane Doe',
      email: 'jane@user-kit.local',
      realm_access: { roles: ['admin', 'user'] },
    },
    ...overrides,
  } as unknown as User;
}

function createManager(overrides: Partial<UserManager> = {}): UserManager {
  return {
    getUser: vi.fn().mockResolvedValue(null),
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signinRedirectCallback: vi.fn().mockResolvedValue(user()),
    signinSilent: vi.fn().mockResolvedValue(null),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
    storeUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UserManager;
}

function setSearch(search: string): void {
  window.history.replaceState({}, document.title, `/${search}`);
}

beforeEach(() => {
  window.sessionStorage.clear();
  setSearch('');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OidcAuthProvider', () => {
  it('has no principal while the store is empty', async () => {
    const provider = new OidcAuthProvider(config, createManager());

    await expect(provider.restore()).resolves.toBeNull();
    await expect(provider.getAccessToken()).resolves.toBeNull();
  });

  it('maps the claims of a stored session onto the application roles', async () => {
    const manager = createManager({ getUser: vi.fn().mockResolvedValue(user()) });
    const provider = new OidcAuthProvider(config, manager);

    await expect(provider.restore()).resolves.toEqual({
      subject: 'oidc-1',
      username: 'jane',
      displayName: 'Jane Doe',
      email: 'jane@user-kit.local',
      // The mapper keeps the highest role only, so the plain `user` role is dropped.
      roles: ['admin'],
    });
  });

  it('prefers the configured roles claim', async () => {
    const manager = createManager({
      getUser: vi
        .fn()
        .mockResolvedValue(user({ profile: { sub: 'oidc-1', preferred_username: 'jane', groups: ['user'] } as never })),
    });
    const provider = new OidcAuthProvider({ ...config, rolesClaim: 'groups' }, manager);

    await expect(provider.restore()).resolves.toMatchObject({ roles: ['user'] });
  });

  it('finishes the redirect callback and restores the requested hash', async () => {
    setSearch('?code=abc&state=xyz');
    saveReturnUrl('#/admin-users');
    const manager = createManager();
    const provider = new OidcAuthProvider(config, manager);

    const restored = await provider.restore();

    expect(manager.signinRedirectCallback).toHaveBeenCalledOnce();
    expect(restored).toMatchObject({ username: 'jane' });
    expect(window.location.hash).toBe('#/admin-users');
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
  });

  it('drops a broken session and reports why', async () => {
    const manager = createManager({ getUser: vi.fn().mockRejectedValue(new Error('session expired')) });
    const provider = new OidcAuthProvider(config, manager);

    await expect(provider.restore()).rejects.toBeInstanceOf(AuthenticationError);
    await expect(provider.restore()).rejects.toThrow('session expired');
    expect(manager.removeUser).toHaveBeenCalled();
  });

  it('starts the redirect login and remembers the return url', async () => {
    const manager = createManager();
    const provider = new OidcAuthProvider(config, manager);

    await provider.login('#/documents');

    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBe('#/documents');
    expect(manager.signinRedirect).toHaveBeenCalledOnce();
  });

  it('starts the login without a return url', async () => {
    const manager = createManager();
    const provider = new OidcAuthProvider(config, manager);

    await provider.login();

    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
  });

  it('removes the session and redirects to the end session endpoint on logout', async () => {
    const manager = createManager({ getUser: vi.fn().mockResolvedValue(user()) });
    const provider = new OidcAuthProvider(config, manager);
    await provider.restore();
    const listener = vi.fn();
    provider.onAuthenticated(listener);

    await provider.logout();

    expect(manager.removeUser).toHaveBeenCalled();
    expect(manager.signoutRedirect).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('returns the access token of a valid session', async () => {
    const manager = createManager({ getUser: vi.fn().mockResolvedValue(user()) });
    const provider = new OidcAuthProvider(config, manager);

    await expect(provider.getAccessToken()).resolves.toBe('access-1');
  });

  it('renews an expired session and stores the new user', async () => {
    const renewed = user({ access_token: 'access-2', expired: false });
    const manager = createManager({
      getUser: vi.fn().mockResolvedValue(user({ expired: true })),
      signinSilent: vi.fn().mockResolvedValue(renewed),
    });
    const provider = new OidcAuthProvider(config, manager);

    await expect(provider.getAccessToken()).resolves.toBe('access-2');
    expect(manager.storeUser).toHaveBeenCalledWith(renewed);
  });

  it('returns no token for an expired session that cannot be renewed', async () => {
    const withoutRefresh = createManager({
      getUser: vi.fn().mockResolvedValue(user({ expired: true, refresh_token: undefined })),
    });
    await expect(new OidcAuthProvider(config, withoutRefresh).getAccessToken()).resolves.toBeNull();

    const silentWithoutUser = createManager({
      getUser: vi.fn().mockResolvedValue(user({ expired: true })),
      signinSilent: vi.fn().mockResolvedValue(null),
    });
    await expect(new OidcAuthProvider(config, silentWithoutUser).getAccessToken()).resolves.toBeNull();

    const failingSilentRenew = createManager({
      getUser: vi.fn().mockResolvedValue(user({ expired: true })),
      signinSilent: vi.fn().mockRejectedValue(new Error('interaction_required')),
    });
    await expect(new OidcAuthProvider(config, failingSilentRenew).getAccessToken()).resolves.toBeNull();
  });

  it('reports the current user to a new listener and stops on unsubscribe', async () => {
    const manager = createManager({ getUser: vi.fn().mockResolvedValue(user()) });
    const provider = new OidcAuthProvider(config, manager);
    const listener = vi.fn();

    const unsubscribe = provider.onAuthenticated(listener);
    await provider.restore();
    expect(listener).toHaveBeenNthCalledWith(1, null);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'jane' }));

    unsubscribe();
    await provider.logout();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('return url of the login', () => {
  it('is read exactly once', () => {
    saveReturnUrl('#/admin-users');

    expect(consumeReturnUrl()).toBe('#/admin-users');
    expect(consumeReturnUrl()).toBeNull();
  });
});
