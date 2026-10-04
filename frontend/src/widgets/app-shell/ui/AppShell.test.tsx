import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

import type { AuthenticatedUser } from '@/entities/user';

import { createThemeStore } from '@/features/theme-switch';
import { i18n } from '@/shared/i18n';

const ADMIN: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

const USER: AuthenticatedUser = { ...ADMIN, username: 'bob', displayName: 'Bob Roe', roles: ['user'] };

function navItems(container: HTMLElement): (HTMLElement & { text: string; selected: boolean })[] {
  return [...container.querySelectorAll('ui5-side-navigation-item')] as (HTMLElement & {
    text: string;
    selected: boolean;
  })[];
}

function renderShell(user: AuthenticatedUser, routeId: string, onLogout = () => undefined) {
  return render(
    <AppShell user={user} routeId={routeId} themeStore={createThemeStore('sap_horizon')} onLogout={onLogout}>
      <p>page content</p>
    </AppShell>,
  );
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '';
  window.localStorage.clear();
});

describe('AppShell', () => {
  it('shows the title, the signed in user and the routed page', () => {
    const { container } = renderShell(ADMIN, 'documents');

    const shellBar = container.querySelector('ui5-shellbar');
    expect(shellBar?.getAttribute('primary-title')).toBe(i18n.t('app.title'));
    expect(shellBar?.getAttribute('secondary-title')).toBe('Jane Doe');
    expect(container.querySelector('.content-host')?.textContent).toBe('page content');
  });

  it('offers every navigation entry an admin may open', () => {
    const { container } = renderShell(ADMIN, 'documents');

    expect(navItems(container).map((item) => item.text)).toEqual([i18n.t('nav.documents'), i18n.t('nav.adminUsers')]);
  });

  it('hides the administration entry from a plain user', () => {
    const { container } = renderShell(USER, 'admin-users');

    expect(navItems(container).map((item) => item.text)).toEqual([i18n.t('nav.documents')]);
  });

  it('marks the current route as selected', () => {
    const { container } = renderShell(ADMIN, 'admin-users');

    expect(navItems(container).map((item) => item.selected)).toEqual([false, true]);
  });

  it('falls back to the first allowed route for an unknown or forbidden hash', () => {
    const { container } = renderShell(USER, 'admin-users');

    expect(navItems(container).map((item) => item.selected)).toEqual([true]);
  });

  it('navigates when an entry is clicked', () => {
    const { container } = renderShell(ADMIN, 'documents');

    fireEvent.click(navItems(container)[1]);

    expect(window.location.hash).toBe('#/admin-users');
  });

  it('carries the theme and language switches and the profile menu', () => {
    const { container } = renderShell(ADMIN, 'documents');

    expect(container.querySelectorAll('ui5-shellbar-item')).toHaveLength(2);
    expect(container.querySelector('ui5-avatar')).not.toBeNull();
  });

  it('signs the user out through the profile menu', () => {
    const onLogout = vi.fn();
    const { container } = renderShell(ADMIN, 'documents', onLogout);

    fireEvent.click(container.querySelector('ui5-avatar') as Element);
    fireEvent.click(container.querySelectorAll('ui5-menu-item')[1]);

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
