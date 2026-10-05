import { hasRole, type AuthenticatedUser, type Role } from '@/entities/user';
import { ICONS, type IconComponent } from '@/shared/ui';

export interface NavEntry {
  id: string;
  /** Translation key of the label; resolved at render time. */
  titleKey: string;
  icon: IconComponent;
  /** At least one of the roles is required to see the entry. */
  roles: Role[];
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  { id: 'documents', titleKey: 'nav.documents', icon: ICONS.documents, roles: ['user', 'admin'] },
  { id: 'admin-users', titleKey: 'nav.adminUsers', icon: ICONS.users, roles: ['admin'] },
];

export const DEFAULT_ROUTE = 'documents';

export function visibleNavEntries(user: AuthenticatedUser | null | undefined): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.roles.some((role) => hasRole(user, role)));
}

export function defaultRouteFor(user: AuthenticatedUser | null | undefined): string {
  const entries = visibleNavEntries(user);
  return entries[0]?.id ?? DEFAULT_ROUTE;
}

/**
 * Returns the route for the current URL hash, falling back to the first route the
 * user is allowed to open. Unknown and forbidden hashes must not leak content.
 */
export function resolveRoute(hash: string, allowedRoutes: readonly string[]): string {
  const normalized = hash.replace(/^#\/?/, '').split('?')[0].trim();
  return allowedRoutes.includes(normalized) ? normalized : (allowedRoutes[0] ?? DEFAULT_ROUTE);
}
