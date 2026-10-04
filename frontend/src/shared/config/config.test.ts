import { describe, expect, it } from 'vitest';

import { assertConfigured, ConfigurationError, readConfig } from './config';

describe('readConfig', () => {
  it('uses same-origin API, sap_horizon and russian by default', () => {
    const config = readConfig({});

    expect(config.apiBaseUrl).toBe('');
    expect(config.authMode).toBe('oidc');
    expect(config.theme).toBe('sap_horizon');
    expect(config.defaultLocale).toBe('ru');
    expect(config.oidc.clientId).toBe('user-kit-web');
    expect(config.oidc.scope).toBe('openid profile email');
    expect(config.dev.role).toBe('user');
  });

  it('strips the trailing slash of the API base URL', () => {
    expect(readConfig({ VITE_API_BASE_URL: 'http://localhost:8080/' }).apiBaseUrl).toBe('http://localhost:8080');
  });

  it('reads the OIDC settings', () => {
    const config = readConfig({
      VITE_OIDC_AUTHORITY: 'https://user-kit.local/auth/realms/user-kit',
      VITE_OIDC_CLIENT_ID: 'app',
      VITE_OIDC_REDIRECT_URI: 'https://app.example.com/',
      VITE_OIDC_ROLES_CLAIM: 'realm_access.roles',
      VITE_AUTH_MODE: 'OIDC',
    });

    expect(config.authMode).toBe('oidc');
    expect(config.oidc.authority).toBe('https://user-kit.local/auth/realms/user-kit');
    expect(config.oidc.redirectUri).toBe('https://app.example.com/');
    expect(config.oidc.rolesClaim).toBe('realm_access.roles');
  });

  it('keeps the dev role unnormalized so shared stays free of the role model', () => {
    expect(readConfig({ VITE_AUTH_MODE: 'dev', VITE_DEV_ROLE: 'ADMIN' }).dev.role).toBe('ADMIN');
    expect(readConfig({ VITE_AUTH_MODE: 'dev', VITE_DEV_ROLE: 'root' }).dev.role).toBe('root');
  });

  it('reads the default locale of the interface', () => {
    expect(readConfig({ VITE_DEFAULT_LOCALE: 'en' }).defaultLocale).toBe('en');
  });

  it('rejects an unknown auth mode', () => {
    expect(() => readConfig({ VITE_AUTH_MODE: 'basic' })).toThrow(ConfigurationError);
  });
});

describe('assertConfigured', () => {
  it('requires the authority and redirect uri in oidc mode', () => {
    expect(() => assertConfigured(readConfig({}))).toThrow(ConfigurationError);
    expect(() =>
      assertConfigured(readConfig({ VITE_OIDC_AUTHORITY: 'https://idp', VITE_OIDC_REDIRECT_URI: 'https://app/' })),
    ).not.toThrow();
  });

  it('does not require OIDC settings in dev mode', () => {
    expect(() => assertConfigured(readConfig({ VITE_AUTH_MODE: 'dev' }))).not.toThrow();
  });
});
