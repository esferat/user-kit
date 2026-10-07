import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  collectRoles,
  extractRoles,
  hasRole,
  isAdmin,
  normalizeRole,
  readClaimPath,
  roleLabel,
  toAuthenticatedUser,
} from './roles';

import type { AuthenticatedUser } from './types';

import { i18n } from '@/shared/i18n';

beforeEach(() => {
  i18n.setLocale('ru');
});

afterEach(() => {
  i18n.setLocale('ru');
});

describe('normalizeRole', () => {
  it('accepts known roles case-insensitively', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole(' User ')).toBe('user');
  });

  it('rejects unknown values', () => {
    expect(normalizeRole('root')).toBeUndefined();
    expect(normalizeRole(42)).toBeUndefined();
    expect(normalizeRole(null)).toBeUndefined();
  });
});

describe('collectRoles', () => {
  it('ignores non arrays and duplicates', () => {
    expect(collectRoles('admin')).toEqual([]);
    expect(collectRoles(['admin', 'ADMIN', 'guest', 'user'])).toEqual(['admin', 'user']);
  });
});

describe('readClaimPath', () => {
  it('reads nested claims', () => {
    const claims = { realm_access: { roles: ['admin'] } };
    expect(readClaimPath(claims, 'realm_access.roles')).toEqual(['admin']);
    expect(readClaimPath(claims, 'realm_access')).toEqual({ roles: ['admin'] });
  });

  it('rejects malformed paths', () => {
    expect(readClaimPath({ a: 1 }, 'a..b')).toBeUndefined();
    expect(readClaimPath({ a: 1 }, 'a;drop')).toBeUndefined();
  });
});

describe('extractRoles', () => {
  it('reads realm_access.roles by default', () => {
    expect(extractRoles({ realm_access: { roles: ['user', 'admin'] } })).toEqual(['admin']);
  });

  it('honours an explicit roles claim path', () => {
    const claims = { custom: { members: ['admin'] }, realm_access: { roles: ['user'] } };
    expect(extractRoles(claims, { rolesClaim: 'custom.members' })).toEqual(['admin']);
  });

  it('reads resource_access for the given client id', () => {
    const claims = { resource_access: { 'user-kit-web': { roles: ['admin'] } } };
    expect(extractRoles(claims, { clientId: 'user-kit-web' })).toEqual(['admin']);
  });

  it('falls back to the user role when no claim matches', () => {
    expect(extractRoles({ sub: '1' })).toEqual(['user']);
    expect(extractRoles({ roles: 'not-a-list' })).toEqual(['user']);
  });

  it('admin implies user and drops the duplicate', () => {
    expect(extractRoles({ roles: ['user', 'admin'] })).toEqual(['admin']);
  });
});

describe('hasRole / isAdmin', () => {
  const user: AuthenticatedUser = {
    subject: '1',
    username: 'jane',
    displayName: 'Jane',
    roles: ['user'],
  };

  it('reads roles from the principal', () => {
    expect(hasRole(user, 'user')).toBe(true);
    expect(hasRole(user, 'admin')).toBe(false);
    expect(isAdmin(user)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe('toAuthenticatedUser', () => {
  it('maps standard OIDC claims', () => {
    const principal = toAuthenticatedUser({
      sub: '42',
      email: 'jane@example.com',
      preferred_username: 'jane',
      name: 'Jane Doe',
      realm_access: { roles: ['admin'] },
    });

    expect(principal).toEqual({
      subject: '42',
      username: 'jane',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
      roles: ['admin'],
    });
  });

  it('works without optional claims', () => {
    const principal = toAuthenticatedUser({ sub: '7' });
    expect(principal.username).toBe('7');
    expect(principal.displayName).toBe('7');
    expect(principal.roles).toEqual(['user']);
    expect('email' in principal).toBe(false);
  });
});

describe('roleLabel', () => {
  it('follows the active locale', () => {
    expect(roleLabel('admin')).toBe('Администратор');
    expect(roleLabel('user')).toBe('Пользователь');

    i18n.setLocale('en');
    expect(roleLabel('admin')).toBe('Administrator');
    expect(roleLabel('user')).toBe('User');
  });
});
