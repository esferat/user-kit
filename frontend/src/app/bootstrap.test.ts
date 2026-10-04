import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrap } from './bootstrap';

import { i18n } from '@/shared/i18n';
import type { AppConfig } from '@/shared/config';

vi.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

const SESSION_KEY = 'user-kit:dev-session';

const config: AppConfig = {
  apiBaseUrl: '',
  authMode: 'dev',
  theme: 'sap_horizon',
  defaultLocale: 'ru',
  oidc: {
    authority: '',
    clientId: 'user-kit-web',
    redirectUri: '',
    postLogoutRedirectUri: '',
    scope: 'openid profile email',
    rolesClaim: '',
  },
  dev: { role: 'admin' },
};

function seedDevSession(): void {
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: 'dev-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      subject: '1',
      email: 'admin@user-kit.local',
      displayName: 'Администратор',
      roles: ['admin', 'user'],
    }),
  );
}

/** The documents page loads the file list in the background, which is irrelevant here. */
function stubApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [], '@odata.count': 0 }),
    }),
  );
}

function render(root: HTMLElement): void {
  return bootstrap(root, config);
}

describe('bootstrap', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.location.hash = '';
    stubApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('renders the shell for a restored dev session', async () => {
    seedDevSession();
    const root = document.createElement('div');
    document.body.appendChild(root);

    await render(root);

    expect(root.querySelector('ui5-navigation-layout')).not.toBeNull();
    expect(root.querySelector('ui5-side-navigation-item')).not.toBeNull();
  });

  it('renders the login page without a session', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    await render(root);

    expect(root.querySelector('ui5-navigation-layout')).toBeNull();
    expect(root.querySelector('ui5-card')).not.toBeNull();
    expect(root.textContent).toContain(i18n.t('login.submit'));
  });

  it('returns to the login page when the logout entry of the profile menu is used', async () => {
    seedDevSession();
    const root = document.createElement('div');
    document.body.appendChild(root);
    await render(root);

    const logout = [...root.querySelectorAll('ui5-menu-item')].at(-1);
    expect(logout?.textContent).toBe(i18n.t('shell.logout'));
    logout?.dispatchEvent(new CustomEvent('click'));

    await vi.waitFor(() => expect(root.querySelector('ui5-navigation-layout')).toBeNull());
    expect(root.querySelector('ui5-card')).not.toBeNull();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('stops routing into the shell after the logout', async () => {
    seedDevSession();
    const root = document.createElement('div');
    document.body.appendChild(root);
    await render(root);

    const logout = [...root.querySelectorAll('ui5-menu-item')].at(-1);
    logout?.dispatchEvent(new CustomEvent('click'));
    await vi.waitFor(() => expect(root.querySelector('ui5-card')).not.toBeNull());

    window.location.hash = '#/admin-users';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(root.querySelector('ui5-navigation-layout')).toBeNull();
  });
});
