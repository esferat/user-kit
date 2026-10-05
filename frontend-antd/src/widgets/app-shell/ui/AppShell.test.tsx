import { fireEvent, render, waitFor } from '@testing-library/react';
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

interface NavItem extends HTMLElement {
  selected: boolean;
}

function navItems(container: HTMLElement): NavItem[] {
  return [...container.querySelectorAll('.ant-menu-item')].map((item) => {
    const element = item as NavItem;
    Object.defineProperty(element, 'selected', {
      configurable: true,
      get: () => element.classList.contains('ant-menu-item-selected'),
    });
    return element;
  });
}

function renderShell(user: AuthenticatedUser, routeId: string, onLogout = () => undefined) {
  return render(
    <AppShell user={user} routeId={routeId} themeStore={createThemeStore('light')} onLogout={onLogout}>
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

    expect(container.querySelector('.app-header-primary')?.textContent).toBe(i18n.t('app.title'));
    expect(container.querySelector('.app-header-secondary')?.textContent).toBe('Jane Doe');
    expect(container.querySelector('.app-content')?.textContent).toBe('page content');
  });

  it('offers every navigation entry an admin may open', () => {
    const { container } = renderShell(ADMIN, 'documents');

    expect(navItems(container).map((item) => item.textContent)).toEqual([
      i18n.t('nav.documents'),
      i18n.t('nav.adminUsers'),
    ]);
  });

  it('hides the administration entry from a plain user', () => {
    const { container } = renderShell(USER, 'admin-users');

    expect(navItems(container).map((item) => item.textContent)).toEqual([i18n.t('nav.documents')]);
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

    expect(container.querySelectorAll('.app-header-actions button')).toHaveLength(2);
    expect(container.querySelector('.ant-avatar')).not.toBeNull();
  });

  it('signs the user out through the profile menu', async () => {
    const onLogout = vi.fn();
    const { container } = renderShell(ADMIN, 'documents', onLogout);

    fireEvent.click(container.querySelector('.ant-avatar') as Element);
    const items = await waitFor(() => {
      const found = [...document.querySelectorAll('.ant-dropdown-menu-item')];
      expect(found).toHaveLength(2);
      return found;
    });
    fireEvent.click(items[1]);

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
