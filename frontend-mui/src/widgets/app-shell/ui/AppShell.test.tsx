import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

import type { AuthenticatedUser } from '@/entities/user';

import { themeReducer } from '@/features/theme-switch';
import { i18n } from '@/shared/i18n';

const ADMIN: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

const USER: AuthenticatedUser = { ...ADMIN, username: 'bob', displayName: 'Bob Roe', roles: ['user'] };

function navItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('.nav-entry')] as HTMLElement[];
}

function isSelected(item: HTMLElement): boolean {
  return item.getAttribute('aria-current') === 'page';
}

function renderShell(user: AuthenticatedUser, routeId: string, onLogout = () => undefined) {
  const store = configureStore({ reducer: { theme: themeReducer } });
  return render(
    <Provider store={store}>
      <AppShell user={user} routeId={routeId} onLogout={onLogout}>
        <p>page content</p>
      </AppShell>
    </Provider>,
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

    expect(navItems(container).map(isSelected)).toEqual([false, true]);
  });

  it('falls back to the first allowed route for an unknown or forbidden hash', () => {
    const { container } = renderShell(USER, 'admin-users');

    expect(navItems(container).map(isSelected)).toEqual([true]);
  });

  it('navigates when an entry is clicked', () => {
    const { container } = renderShell(ADMIN, 'documents');

    fireEvent.click(navItems(container)[1]);

    expect(window.location.hash).toBe('#/admin-users');
  });

  it('carries the theme and language switches and the profile menu', () => {
    const { container } = renderShell(ADMIN, 'documents');

    expect(container.querySelectorAll('.app-header-actions button')).toHaveLength(3);
    expect(container.querySelector('.profile-avatar')).not.toBeNull();
  });

  it('signs the user out through the profile menu', async () => {
    const onLogout = vi.fn();
    const { container } = renderShell(ADMIN, 'documents', onLogout);

    fireEvent.click(container.querySelector('.profile-avatar') as Element);
    const items = await waitFor(() => {
      const found = [...document.querySelectorAll('.profile-logout')];
      expect(found).toHaveLength(1);
      return found;
    });
    fireEvent.click(items[0]);

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
