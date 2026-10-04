import { describe, expect, it } from 'vitest';

import { createAuthProvider } from './createAuthProvider';

import { readConfig } from '@/shared/config';

describe('createAuthProvider', () => {
  it('uses the OIDC provider by default', () => {
    const provider = createAuthProvider(
      readConfig({ VITE_OIDC_AUTHORITY: 'https://idp', VITE_OIDC_REDIRECT_URI: 'https://app/' }),
    );

    expect(provider.kind).toBe('oidc');
  });

  it('uses the dev provider in dev mode', () => {
    expect(createAuthProvider(readConfig({ VITE_AUTH_MODE: 'dev' })).kind).toBe('dev');
  });

  it('refuses to start in oidc mode without a complete configuration', () => {
    expect(() => createAuthProvider(readConfig({}))).toThrow();
  });
});
