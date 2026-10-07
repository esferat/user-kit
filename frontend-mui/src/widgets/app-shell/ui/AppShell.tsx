import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';

import { resolveRoute, visibleNavEntries } from '../model/navigation';

import { ProfileMenu } from './ProfileMenu';

import type { ReactNode } from 'react';

import type { AuthenticatedUser } from '@/entities/user';

import { LocaleSwitchButton } from '@/features/locale-switch';
import { ThemeSwitchButton } from '@/features/theme-switch';
import { useTranslate } from '@/shared/i18n';

export interface AppShellProps {
  user: AuthenticatedUser;
  /** Id текущего маршрута; отрисовываются только маршруты, доступные пользователю. */
  routeId: string;
  onLogout(): void;
  children: ReactNode;
}

/**
 * Оболочка аутентифицированного приложения: шапка с меню профиля, переключателями
 * темы и языка, боковая навигация и страница по маршруту.
 */
export function AppShell({ user, routeId, onLogout, children }: AppShellProps) {
  const t = useTranslate();
  const entries = visibleNavEntries(user);
  const allowedRoutes = entries.map((entry) => entry.id);
  const resolved = resolveRoute(routeId, allowedRoutes);

  return (
    <Box className="app-shell" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box className="app-header">
        <div className="app-header-title">
          <span className="app-header-primary">{t('app.title')}</span>
          <span className="app-header-secondary">{user.displayName}</span>
        </div>
        <div className="app-header-actions">
          <ThemeSwitchButton />
          <LocaleSwitchButton />
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box
          className="app-sider"
          component="nav"
          aria-label={t('shell.sideNavigation')}
          sx={{ width: 240, flexShrink: 0, overflowY: 'auto' }}
        >
          <List disablePadding>
            {entries.map((entry) => (
              <ListItemButton
                key={entry.id}
                className="nav-entry"
                selected={resolved === entry.id}
                aria-current={resolved === entry.id ? 'page' : undefined}
                onClick={() => {
                  window.location.hash = `#/${entry.id}`;
                }}
              >
                <ListItemIcon>
                  <entry.icon />
                </ListItemIcon>
                <ListItemText>{t(entry.titleKey)}</ListItemText>
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box className="app-content" sx={{ flex: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
