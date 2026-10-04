import '@ui5/webcomponents/dist/Avatar.js';
import '@ui5/webcomponents/dist/Menu.js';
import '@ui5/webcomponents/dist/MenuItem.js';
import '@ui5/webcomponents/dist/Popover.js';
import '@ui5/webcomponents-fiori/dist/NavigationLayout.js';
import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '@ui5/webcomponents-fiori/dist/ShellBarItem.js';
import '@ui5/webcomponents-fiori/dist/SideNavigation.js';
import '@ui5/webcomponents-fiori/dist/SideNavigationItem.js';

import { DEFAULT_ROUTE, visibleNavEntries, type NavEntry } from '../model/navigation';

import type Avatar from '@ui5/webcomponents/dist/Avatar.js';
import type MenuItem from '@ui5/webcomponents/dist/MenuItem.js';
import type Popover from '@ui5/webcomponents/dist/Popover.js';
import type ShellBar from '@ui5/webcomponents-fiori/dist/ShellBar.js';
import type ShellBarItem from '@ui5/webcomponents-fiori/dist/ShellBarItem.js';
import type SideNavigation from '@ui5/webcomponents-fiori/dist/SideNavigation.js';
import type SideNavigationItem from '@ui5/webcomponents-fiori/dist/SideNavigationItem.js';

import type { AuthenticatedUser } from '@/entities/user';
import type { AuthProvider } from '@/features/auth';

import { createLocaleSwitchItem } from '@/features/locale-switch';
import { createThemeSwitchItem, type ThemeStore } from '@/features/theme-switch';
import { t } from '@/shared/i18n';
import { element, initialsOf } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export interface AppShellOptions {
  user: AuthenticatedUser;
  auth: AuthProvider;
  themeStore: ThemeStore;
  /** Called after the interface language changed, so the content can be repainted. */
  onLocaleChanged(): void;
  /** Renders the page of the resolved route into the given host element. */
  renderContent(host: HTMLElement, routeId: string, user: AuthenticatedUser): void;
}

export interface AppShell {
  readonly element: HTMLElement;
  /** Renders the page that belongs to the current route. */
  renderRoute(routeId: string): void;
}

function appendNavItem(sideNavigation: SideNavigation, entry: NavEntry): SideNavigationItem {
  const item = document.createElement('ui5-side-navigation-item') as SideNavigationItem;
  item.text = t(entry.titleKey);
  item.icon = entry.icon;
  item.addEventListener('click', () => {
    window.location.hash = `#/${entry.id}`;
  });
  sideNavigation.appendChild(item);
  return item;
}

function createProfile(shellBar: ShellBar, user: AuthenticatedUser, onLogout: () => void): void {
  const avatar = document.createElement('ui5-avatar') as Avatar;
  avatar.initials = initialsOf(user.displayName);
  avatar.interactive = true;
  avatar.accessibleName = t('shell.profile', { name: user.displayName });

  const accountItem = document.createElement('ui5-menu-item') as MenuItem;
  accountItem.textContent = user.email ?? user.username;
  accountItem.icon = ICONS.account;

  const logoutItem = document.createElement('ui5-menu-item') as MenuItem;
  logoutItem.textContent = t('shell.logout');
  logoutItem.icon = ICONS.logout;
  logoutItem.addEventListener('click', () => {
    onLogout();
  });

  const profileMenu = document.createElement('ui5-menu');
  profileMenu.append(accountItem, logoutItem);

  const profilePopover = document.createElement('ui5-popover') as Popover;
  profilePopover.placement = 'Bottom';
  profilePopover.appendChild(profileMenu);

  avatar.addEventListener('click', () => {
    profilePopover.opener = avatar;
    profilePopover.open = !profilePopover.open;
  });
  avatar.setAttribute('slot', 'profile');
  profilePopover.setAttribute('slot', 'profile');
  shellBar.append(avatar, profilePopover);
}

/**
 * Shell of the authenticated application: shell bar with the profile menu, theme
 * and language switches, the side navigation and the host for the routed pages.
 */
export function createAppShell(options: AppShellOptions): AppShell {
  const { user, auth, themeStore } = options;
  const entries = visibleNavEntries(user);
  const allowedRoutes = entries.map((entry) => entry.id);

  const shellBar = document.createElement('ui5-shellbar') as ShellBar;
  shellBar.primaryTitle = t('app.title');
  shellBar.secondaryTitle = user.displayName;
  shellBar.setAttribute('slot', 'header');

  const themeItem: ShellBarItem = createThemeSwitchItem(themeStore);
  const localeItem = createLocaleSwitchItem(options.onLocaleChanged);
  shellBar.append(themeItem, localeItem);

  createProfile(shellBar, user, () => {
    void auth.logout();
  });

  const sideNavigation = document.createElement('ui5-side-navigation') as SideNavigation;
  sideNavigation.setAttribute('slot', 'sideContent');
  sideNavigation.accessibleName = t('shell.sideNavigation');

  const navItems = new Map<string, SideNavigationItem>();
  entries.forEach((entry) => navItems.set(entry.id, appendNavItem(sideNavigation, entry)));

  const contentHost = element('div', { className: 'content-host' });
  const layout = document.createElement('ui5-navigation-layout');
  layout.append(shellBar, sideNavigation, contentHost);

  const renderRoute = (routeId: string): void => {
    const resolved = allowedRoutes.includes(routeId) ? routeId : (allowedRoutes[0] ?? DEFAULT_ROUTE);
    navItems.forEach((item, id) => {
      item.selected = id === resolved;
    });
    options.renderContent(contentHost, resolved, user);
  };

  return {
    element: layout,
    renderRoute,
  };
}
