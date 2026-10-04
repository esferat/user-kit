import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthProvider } from '@/features/auth';
import type { ThemeStore } from '@/features/theme-switch';

import type { AuthenticatedUser } from '@/entities/user';
import { i18n } from '@/shared/i18n';

import { createAppShell } from './appShell';

vi.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

const admin: AuthenticatedUser = {
  subject: '2',
  username: 'root',
  displayName: 'Root Rivera',
  email: 'root@user-kit.local',
  roles: ['admin'],
};

function createAuth(): AuthProvider {
  return {
    kind: 'dev',
    restore: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue('token'),
    onAuthenticated: vi.fn().mockReturnValue(() => undefined),
  };
}

function createThemeStore(): ThemeStore {
  return {
    current: () => 'sap_horizon',
    isDark: () => false,
    apply: vi.fn().mockResolvedValue('sap_horizon'),
    toggle: vi.fn().mockResolvedValue('sap_horizon_dark'),
  };
}

function createShell(user: AuthenticatedUser = admin) {
  const auth = createAuth();
  const renderContent = vi.fn();
  const onLocaleChanged = vi.fn();
  const shell = createAppShell({
    user,
    auth,
    themeStore: createThemeStore(),
    onLocaleChanged,
    renderContent,
  });
  document.body.appendChild(shell.element);
  return { shell, auth, renderContent, onLocaleChanged };
}

/** UI5 keeps `text` in a property, it is not mirrored into the markup. */
function label(element: Element | null): string {
  return (element as (Element & { text?: string }) | null)?.text ?? '';
}

function menuLabel(element: Element | null): string {
  return element?.textContent ?? '';
}

function accessibleName(element: Element | null): string | undefined {
  return (element as (Element & { accessibleName?: string }) | null)?.accessibleName;
}

describe('createAppShell', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
    document.body.replaceChildren();
  });

  it('renders the shell bar, the side navigation and the content host', () => {
    const { shell } = createShell();

    expect(shell.element.tagName.toLowerCase()).toBe('ui5-navigation-layout');
    expect(shell.element.querySelector('ui5-shellbar')).not.toBeNull();
    expect(shell.element.querySelector('ui5-side-navigation')).not.toBeNull();
    expect(shell.element.querySelector('.content-host')).not.toBeNull();
  });

  it('lists the navigation entries the user may open', () => {
    const { shell } = createShell();

    const items = [...shell.element.querySelectorAll('ui5-side-navigation-item')];
    expect(items.map((item) => label(item))).toEqual([i18n.t('nav.documents'), i18n.t('nav.adminUsers')]);

    const itemsOfUser = createShell({ ...admin, roles: ['user'] });
    expect(itemsOfUser.shell.element.querySelectorAll('ui5-side-navigation-item')).toHaveLength(1);
  });

  it('navigates when a side navigation entry is clicked', () => {
    const { shell } = createShell();

    const items = shell.element.querySelectorAll('ui5-side-navigation-item');
    items[1].dispatchEvent(new CustomEvent('click'));

    expect(window.location.hash).toBe('#/admin-users');
  });

  it('renders the resolved route and marks it as selected', () => {
    const { shell, renderContent } = createShell();

    shell.renderRoute('admin-users');

    expect(renderContent).toHaveBeenCalledWith(
      shell.element.querySelector('.content-host'),
      'admin-users',
      admin,
    );
    const selected = [...shell.element.querySelectorAll('ui5-side-navigation-item')].filter(
      (item) => (item as { selected?: boolean }).selected === true,
    );
    expect(selected).toHaveLength(1);
    expect(label(selected[0])).toBe(i18n.t('nav.adminUsers'));
  });

  it('falls back to the first allowed route for a forbidden or unknown hash', () => {
    const { shell, renderContent } = createShell({ ...admin, roles: ['user'] });

    shell.renderRoute('admin-users');

    expect(renderContent).toHaveBeenCalledWith(expect.anything(), 'documents', expect.anything());
  });

  it('offers the theme and the language switch in the shell bar', () => {
    const { shell } = createShell();

    const items = [...shell.element.querySelectorAll('ui5-shellbar-item')];

    expect(items.map((item) => label(item))).toEqual([
      i18n.t('shell.theme.dark'),
      i18n.t('locale.name'),
    ]);
  });

  it('puts the account and the logout entry into the profile menu of the shell bar', () => {
    const { shell } = createShell();

    const avatar = shell.element.querySelector('ui5-avatar');
    const popover = shell.element.querySelector('ui5-popover');
    const entries = [...shell.element.querySelectorAll('ui5-menu-item')];

    expect(avatar?.getAttribute('slot')).toBe('profile');
    expect(popover?.getAttribute('slot')).toBe('profile');
    expect(entries.map((entry) => menuLabel(entry))).toEqual([
      'root@user-kit.local',
      i18n.t('shell.logout'),
    ]);
    expect(accessibleName(avatar)).toBe(i18n.t('shell.profile', { name: admin.displayName }));
    expect((avatar as (Element & { initials?: string }) | null)?.initials).toBe('RR');
  });

  it('opens the profile menu from the avatar', () => {
    const { shell } = createShell();

    const avatar = shell.element.querySelector('ui5-avatar') as HTMLElement & { interactive: boolean };
    const popover = shell.element.querySelector('ui5-popover') as HTMLElement & { open: boolean };

    expect(avatar.interactive).toBe(true);
    expect(popover.open).toBe(false);

    avatar.dispatchEvent(new CustomEvent('click'));
    expect(popover.open).toBe(true);

    avatar.dispatchEvent(new CustomEvent('click'));
    expect(popover.open).toBe(false);
  });

  it('logs out when the logout entry of the profile menu is clicked', () => {
    const { shell, auth } = createShell();

    const logout = [...shell.element.querySelectorAll('ui5-menu-item')].at(-1);
    logout?.dispatchEvent(new CustomEvent('click'));

    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it('repaints the route after the language changed', () => {
    const { shell, onLocaleChanged, renderContent } = createShell();

    const localeItem = shell.element.querySelectorAll('ui5-shellbar-item')[1];
    localeItem.dispatchEvent(new CustomEvent('item-click'));

    expect(onLocaleChanged).toHaveBeenCalledOnce();
    expect(renderContent).not.toHaveBeenCalled();
  });
});
