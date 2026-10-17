import { hasRole, type AuthenticatedUser, type Role } from '@/entities/user';

export interface NavEntry {
  id: string;
  href: string;
  title: string;
  /** Роли, которым раздел виден. Это UX: сервер проверяет доступ сам. */
  roles: Role[];
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  { id: 'admin', href: '/admin', title: 'Администрирование', roles: ['admin'] },
];

export function visibleNavEntries(user: AuthenticatedUser | null | undefined): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.roles.some((role) => hasRole(user, role)));
}
