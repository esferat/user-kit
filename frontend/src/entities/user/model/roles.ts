import { DEFAULT_ROLE, ROLES, type AuthenticatedUser, type Role } from './types';

import { t } from '@/shared/i18n';

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
  /** Explicit claim path, e.g. `realm_access.roles`. Wins over the fallbacks. */
  rolesClaim?: string;
  /** Client id, used to read `resource_access.<clientId>.roles`. */
  clientId?: string;
}

const FALLBACK_CLAIMS = ['roles', 'groups', 'realm_access.roles', 'resource_access.roles'];

/**
 * Reads `resource_access.<clientId>.roles` directly instead of through a dotted
 * path, because OAuth client ids may contain characters that are not valid in a
 * property path.
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
 * Maps IdP claims onto the two application roles.
 *
 * Unknown/absent claims never produce an empty role set: an authenticated
 * principal always has at least the `user` role.
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
    roles.splice(roles.indexOf('user'), 1);
    return ['admin'];
  }
  return roles.length > 0 ? roles : [DEFAULT_ROLE];
}

export function hasRole(user: AuthenticatedUser | null | undefined, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function isAdmin(user: AuthenticatedUser | null | undefined): boolean {
  return hasRole(user, 'admin');
}

export function toAuthenticatedUser(
  claims: Record<string, unknown>,
  options: ExtractRolesOptions = {},
): AuthenticatedUser {
  const subject = typeof claims.sub === 'string' ? claims.sub : '';
  const email = typeof claims.email === 'string' ? claims.email : undefined;
  const preferredUsername = typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined;
  const displayName = (typeof claims.name === 'string' && claims.name) || email || preferredUsername || subject;

  const user: AuthenticatedUser = {
    subject,
    username: preferredUsername ?? email ?? subject,
    displayName,
    roles: extractRoles(claims, options),
  };
  return email === undefined ? user : { ...user, email };
}

/** Localized name of a role. */
export function roleLabel(role: Role): string {
  return t(role === 'admin' ? 'roles.admin' : 'roles.user');
}
