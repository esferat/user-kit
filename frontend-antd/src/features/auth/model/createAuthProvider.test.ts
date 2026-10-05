import { describe, expect, it } from 'vitest';

import { CookieAuthProvider } from '../cookie/cookieAuthProvider';

import { createAuthProvider } from './createAuthProvider';

import { readConfig } from '@/shared/config';

describe('createAuthProvider', () => {
  it('builds the cookie provider without any identity provider settings', () => {
    expect(createAuthProvider(readConfig({}))).toBeInstanceOf(CookieAuthProvider);
  });

  it('takes the dev role from the configuration', () => {
    expect(createAuthProvider(readConfig({ VITE_DEV_ROLE: 'admin' }))).toBeInstanceOf(CookieAuthProvider);
  });
});
