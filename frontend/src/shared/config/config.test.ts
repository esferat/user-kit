import { describe, expect, it } from 'vitest';

import { readConfig } from './config';

describe('readConfig', () => {
  it('uses same-origin API, sap_horizon and russian by default', () => {
    const config = readConfig({});

    expect(config.apiBaseUrl).toBe('');
    expect(config.theme).toBe('sap_horizon');
    expect(config.defaultLocale).toBe('ru');
    expect(config.dev.role).toBe('user');
  });

  it('strips the trailing slash of the API base URL', () => {
    expect(readConfig({ VITE_API_BASE_URL: 'http://localhost:8080/' }).apiBaseUrl).toBe('http://localhost:8080');
  });

  it('keeps the dev role unnormalized so shared stays free of the role model', () => {
    expect(readConfig({ VITE_DEV_ROLE: 'ADMIN' }).dev.role).toBe('ADMIN');
    expect(readConfig({ VITE_DEV_ROLE: 'root' }).dev.role).toBe('root');
  });

  it('reads the default locale of the interface', () => {
    expect(readConfig({ VITE_DEFAULT_LOCALE: 'en' }).defaultLocale).toBe('en');
  });

  it('ignores identity provider settings, the login lives on the backend', () => {
    const config = readConfig({ VITE_OIDC_AUTHORITY: 'https://idp', VITE_AUTH_MODE: 'dev' });

    expect(config).not.toHaveProperty('oidc');
    expect(config).not.toHaveProperty('authMode');
  });
});
