import { describe, expect, it } from 'vitest';

import { DEFAULT_ROUTE, NAV_ENTRIES, defaultRouteFor, resolveRoute, visibleNavEntries } from './navigation';

import type { AuthenticatedUser } from '@/entities/user';

import { ICONS } from '@/shared/ui';

const regularUser: AuthenticatedUser = {
  subject: '1',
  username: 'jane',
  displayName: 'Jane',
  roles: ['user'],
};

const adminUser: AuthenticatedUser = {
  subject: '2',
  username: 'root',
  displayName: 'Root',
  roles: ['admin'],
};

describe('visibleNavEntries', () => {
  it('hides admin pages from regular users', () => {
    const ids = visibleNavEntries(regularUser).map((entry) => entry.id);
    expect(ids).toEqual(['documents']);
  });

  it('shows admin pages to administrators', () => {
    const ids = visibleNavEntries(adminUser).map((entry) => entry.id);
    expect(ids).toEqual(['documents', 'admin-users']);
  });

  it('returns nothing without a principal', () => {
    expect(visibleNavEntries(null)).toEqual([]);
  });

  it('keeps the documents entry available to both roles', () => {
    const documents = NAV_ENTRIES.find((entry) => entry.id === 'documents');
    expect(documents?.roles).toEqual(['user', 'admin']);
  });

  it('uses the shared icon names', () => {
    expect(NAV_ENTRIES.map((entry) => entry.icon)).toEqual([ICONS.documents, ICONS.users]);
  });

  it('addresses the labels by translation key', () => {
    expect(NAV_ENTRIES.map((entry) => entry.titleKey)).toEqual(['nav.documents', 'nav.adminUsers']);
  });
});

describe('defaultRouteFor', () => {
  it('falls back to the first allowed entry', () => {
    expect(defaultRouteFor(adminUser)).toBe('documents');
    expect(defaultRouteFor(null)).toBe(DEFAULT_ROUTE);
  });
});

describe('resolveRoute', () => {
  it('accepts allowed routes in every hash notation', () => {
    expect(resolveRoute('#/documents', ['documents'])).toBe('documents');
    expect(resolveRoute('#documents', ['documents'])).toBe('documents');
    expect(resolveRoute('#/documents/42?x=1', ['documents'])).toBe('documents');
  });

  it('rejects unknown and forbidden routes', () => {
    expect(resolveRoute('#/admin-users', ['documents'])).toBe('documents');
    expect(resolveRoute('', ['documents'])).toBe('documents');
    expect(resolveRoute('#/admin-users', [])).toBe(DEFAULT_ROUTE);
  });
});
