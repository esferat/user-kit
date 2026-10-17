import { DEFAULT_ROLE, ROLES, type AuthenticatedUser, type Role } from './types';
const PROPERTY_PATH = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/;

export function normalizeRole(value: unknown): Role | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return (ROLES as readonly string[]).includes(normalized) ? (normalized as Role) : undefined;
}

export function collectRoles(values: unknown): Role[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const roles: Role[] = [];
  for (const value of values) {
    const role = normalizeRole(value);
    if (role !== undefined && !roles.includes(role)) {
      roles.push(role);
    }
  }
  return roles;
}

export function readClaimPath(claims: Record<string, unknown>, path: string): unknown {
  if (!PROPERTY_PATH.test(path)) {
    return undefined;
  }
  let current: unknown = claims;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export interface ExtractRolesOptions {
  /** Явный путь claim, например `realm_access.roles`. Имеет приоритет над запасными вариантами. */
  rolesClaim?: string;
  /** Client id для чтения `resource_access.<clientId>.roles`. */
  clientId?: string;
}

const FALLBACK_CLAIMS = ['roles', 'groups', 'realm_access.roles', 'resource_access.roles'];

/**
 * Читает `resource_access.<clientId>.roles` напрямую, а не через точечный путь:
 * OAuth client id могут содержать символы, недопустимые в пути к свойству.
 */
function readResourceAccessRoles(claims: Record<string, unknown>, clientId: string): unknown {
  const resourceAccess = claims.resource_access;
  if (typeof resourceAccess !== 'object' || resourceAccess === null) {
    return undefined;
  }
  const client = (resourceAccess as Record<string, unknown>)[clientId];
  if (typeof client !== 'object' || client === null) {
    return undefined;
  }
  return (client as Record<string, unknown>).roles;
}

/**
 * Сопоставляет claims IdP с двумя ролями приложения. Порядок источников
 * повторяет бэкенд: `roles` → `groups` → `realm_access.roles` →
 * `resource_access.<audience>.roles`. Неизвестные значения игнорируются, а
 * аутентифицированный принципал без распознанных ролей получает `user`,
 * `admin` при этом эксклюзивен.
 *
 * Профиль из `GET /api/v1/me` уже содержит готовые роли, поэтому в приложении
 * функция нужна только для полноты картины и повторяет поведение сервера.
 */
export function extractRoles(claims: Record<string, unknown>, options: ExtractRolesOptions = {}): Role[] {
  const sources: unknown[] = options.rolesClaim
    ? [readClaimPath(claims, options.rolesClaim)]
    : [
        ...FALLBACK_CLAIMS.map((path) => readClaimPath(claims, path)),
        ...(options.clientId ? [readResourceAccessRoles(claims, options.clientId)] : []),
      ];

  const roles: Role[] = [];
  for (const source of sources) {
    for (const role of collectRoles(source)) {
      if (!roles.includes(role)) {
        roles.push(role);
      }
    }
  }

  if (roles.includes('admin')) {
    return ['admin'];
  }
  return roles.length > 0 ? roles : [DEFAULT_ROLE];
}

export function hasRole(user: AuthenticatedUser | null | undefined, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function hasAdmin(user: AuthenticatedUser | null | undefined): boolean {
  return hasRole(user, 'admin');
}
