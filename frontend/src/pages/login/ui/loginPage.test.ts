import { beforeEach, describe, expect, it } from 'vitest';

import { renderLoginPage } from './loginPage';

import { i18n } from '@/shared/i18n';

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('renderLoginPage', () => {
  const auth = {
    kind: 'oidc' as const,
    restore: async () => null,
    login: async () => undefined,
    logout: async () => undefined,
    getAccessToken: async () => null,
    onAuthenticated: () => () => undefined,
  };

  it('explains the OIDC login and offers the sign in button', () => {
    const root = document.createElement('div');

    renderLoginPage(root, {
      config: {
        apiBaseUrl: '',
        authMode: 'oidc',
        theme: 'sap_horizon',
        defaultLocale: 'ru',
        oidc: {
          authority: 'https://user-kit.local/auth/realms/user-kit',
          clientId: 'user-kit-web',
          redirectUri: 'https://user-kit.local/',
          postLogoutRedirectUri: '',
          scope: 'openid',
          rolesClaim: '',
        },
        dev: { role: 'admin' },
      },
      auth,
      onAuthenticated: () => undefined,
    });

    expect(root.querySelector('ui5-card')).not.toBeNull();
    expect(root.textContent).toContain('Войти');
    expect(root.textContent).toContain('Keycloak');
    expect(root.querySelector('ui5-message-strip')).toBeNull();
  });

  it('warns about the development token', () => {
    const root = document.createElement('div');

    renderLoginPage(root, {
      config: {
        apiBaseUrl: '',
        authMode: 'dev',
        theme: 'sap_horizon',
        defaultLocale: 'ru',
        oidc: {
          authority: '',
          clientId: 'user-kit-web',
          redirectUri: '',
          postLogoutRedirectUri: '',
          scope: 'openid',
          rolesClaim: '',
        },
        dev: { role: 'admin' },
      },
      auth,
      onAuthenticated: () => undefined,
    });

    const strip = root.querySelector('ui5-message-strip');
    expect(strip?.getAttribute('design')).toBe('Critical');
    expect(strip?.textContent).toContain('Режим разработки');
    expect(strip?.textContent).toContain('admin');
  });

  it('reports a missing authority', () => {
    const root = document.createElement('div');

    renderLoginPage(root, {
      config: {
        apiBaseUrl: '',
        authMode: 'oidc',
        theme: 'sap_horizon',
        defaultLocale: 'ru',
        oidc: {
          authority: '',
          clientId: 'user-kit-web',
          redirectUri: '',
          postLogoutRedirectUri: '',
          scope: 'openid',
          rolesClaim: '',
        },
        dev: { role: 'admin' },
      },
      auth,
      onAuthenticated: () => undefined,
    });

    const strip = root.querySelector('ui5-message-strip');
    expect(strip?.getAttribute('design')).toBe('Negative');
    expect(strip?.textContent).toContain('VITE_OIDC_AUTHORITY');
  });
});
