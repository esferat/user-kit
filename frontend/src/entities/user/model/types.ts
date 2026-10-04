export const ROLES = ['admin', 'user'] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = 'user';

/** Principal of the authenticated session, mapped from the claims of the IdP. */
export interface AuthenticatedUser {
  subject: string;
  username: string;
  displayName: string;
  email?: string;
  roles: Role[];
}

export interface MeResponse {
  id: string;
  subject: string;
  email: string;
  displayName: string;
  roles: Role[];
  enabled: boolean;
}

export interface UserDto {
  id: string;
  subject: string;
  email: string;
  displayName: string;
  roles: Role[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
