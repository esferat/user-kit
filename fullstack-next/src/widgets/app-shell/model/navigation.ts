import { hasRole, type AuthenticatedUser, type Role } from '@/entities/user';

/** Пункт меню со своей страницей. */
export interface NavLink {
  id: string;
  title: string;
  href: string;
  /** Роли, которым раздел виден. Это UX: сервер проверяет доступ сам. */
  roles: Role[];
}

/** Группа меню: собственной страницы нет, пункт только раскрывает подпункты. */
export interface NavGroup {
  id: string;
  title: string;
  roles: Role[];
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    id: 'games',
    title: 'Игры',
    roles: ['admin', 'user'],
    children: [
      { id: 'chess', title: 'Шахматы', href: '/games/chess', roles: ['admin', 'user'] },
      { id: 'checkers', title: 'Шашки', href: '/games/checkers', roles: ['admin', 'user'] },
      { id: 'match3', title: 'Три в ряд', href: '/games/match3', roles: ['admin', 'user'] },
      { id: 'lines', title: 'Цветные линии', href: '/games/lines', roles: ['admin', 'user'] },
    ],
  },
  { id: 'admin', title: 'Администрирование', href: '/admin', roles: ['admin'] },
];

function isVisible(roles: readonly Role[], user: AuthenticatedUser | null | undefined): boolean {
  return roles.some((role) => hasRole(user, role));
}

export function visibleNavEntries(user: AuthenticatedUser | null | undefined): NavEntry[] {
  const visible: NavEntry[] = [];
  for (const entry of NAV_ENTRIES) {
    if (!isVisible(entry.roles, user)) {
      continue;
    }
    if (isNavGroup(entry)) {
      const children = entry.children.filter((child) => isVisible(child.roles, user));
      if (children.length > 0) {
        visible.push({ ...entry, children });
      }
    } else {
      visible.push(entry);
    }
  }
  return visible;
}

/**
 * Id групп, внутри которых лежит текущий маршрут. Их подменю должно быть
 * раскрыто, чтобы выбранный пункт был виден при прямом заходе на страницу.
 */
export function openGroupKeys(pathname: string): string[] {
  return NAV_ENTRIES.filter(isNavGroup)
    .filter((group) => group.children.some((child) => isUnder(pathname, child.href)))
    .map((group) => group.id);
}

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
