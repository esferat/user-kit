import { NavigationLayout } from '@ui5/webcomponents-react/NavigationLayout';
import { ShellBar } from '@ui5/webcomponents-react/ShellBar';
import { SideNavigation } from '@ui5/webcomponents-react/SideNavigation';
import { SideNavigationItem } from '@ui5/webcomponents-react/SideNavigationItem';

import { resolveRoute, visibleNavEntries } from '../model/navigation';

import { ProfileMenu } from './ProfileMenu';

import type { AuthenticatedUser } from '@/entities/user';
import type { ThemeStore } from '@/features/theme-switch';

import { LocaleSwitchButton } from '@/features/locale-switch';
import { ThemeSwitchButton } from '@/features/theme-switch';
import { useTranslate } from '@/shared/i18n';

export interface AppShellProps {
  user: AuthenticatedUser;
  /** Id of the current route; only routes the user may open are rendered. */
  routeId: string;
  themeStore: ThemeStore;
  onLogout(): void;
  children: React.ReactNode;
}

/**
 * Shell of the authenticated application: shell bar with the profile menu, theme
 * and language switches, the side navigation and the routed page.
 */
export function AppShell({ user, routeId, themeStore, onLogout, children }: AppShellProps) {
  const t = useTranslate();
  const entries = visibleNavEntries(user);
  const allowedRoutes = entries.map((entry) => entry.id);
  const resolved = resolveRoute(routeId, allowedRoutes);

  return (
    <NavigationLayout>
      <ShellBar slot="header" primaryTitle={t('app.title')} secondaryTitle={user.displayName}>
        <ThemeSwitchButton store={themeStore} />
        <LocaleSwitchButton />
        <ProfileMenu user={user} onLogout={onLogout} />
      </ShellBar>
      <SideNavigation slot="sideContent" accessibleName={t('shell.sideNavigation')}>
        {entries.map((entry) => (
          <SideNavigationItem
            key={entry.id}
            text={t(entry.titleKey)}
            icon={entry.icon}
            selected={entry.id === resolved}
            onClick={() => {
              window.location.hash = `#/${entry.id}`;
            }}
          />
        ))}
      </SideNavigation>
      <div className="content-host">{children}</div>
    </NavigationLayout>
  );
}
