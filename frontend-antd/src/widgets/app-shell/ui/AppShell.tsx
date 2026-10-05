import { Layout, Menu } from 'antd';

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
 * Shell of the authenticated application: header with the profile menu, theme
 * and language switches, the side navigation and the routed page.
 */
export function AppShell({ user, routeId, themeStore, onLogout, children }: AppShellProps) {
  const t = useTranslate();
  const entries = visibleNavEntries(user);
  const allowedRoutes = entries.map((entry) => entry.id);
  const resolved = resolveRoute(routeId, allowedRoutes);

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header-title">
          <span className="app-header-primary">{t('app.title')}</span>
          <span className="app-header-secondary">{user.displayName}</span>
        </div>
        <div className="app-header-actions">
          <ThemeSwitchButton store={themeStore} />
          <LocaleSwitchButton />
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </Layout.Header>
      <Layout>
        <Layout.Sider className="app-sider" theme="light" width={240}>
          <nav aria-label={t('shell.sideNavigation')}>
            <Menu
              mode="inline"
              selectedKeys={[resolved]}
              items={entries.map((entry) => ({
                key: entry.id,
                icon: <entry.icon />,
                label: t(entry.titleKey),
              }))}
              onClick={({ key }) => {
                window.location.hash = `#/${key}`;
              }}
            />
          </nav>
        </Layout.Sider>
        <Layout.Content className="app-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
