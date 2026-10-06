import { hasRole, type AuthenticatedUser, type Role } from '@/entities/user';
import { ICONS, type IconName } from '@/shared/ui';

export interface NavEntry {
  id: string;
  /** Ключ перевода подписи; разрешается во время отрисовки. */
  titleKey: string;
  icon: IconName;
  /** Для отображения пункта требуется хотя бы одна из ролей. */
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
 * Возвращает маршрут для текущего URL hash, а при его отсутствии — первый маршрут,
 * который пользователь имеет право открыть. Неизвестные и запрещённые hash не должны раскрывать содержимое.
 */
export function resolveRoute(hash: string, allowedRoutes: readonly string[]): string {
  const normalized = hash.replace(/^#\/?/, '').split('?')[0].trim();
  return allowedRoutes.includes(normalized) ? normalized : (allowedRoutes[0] ?? DEFAULT_ROUTE);
}
