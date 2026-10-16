export const ROLES = ['admin', 'user'] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = 'user';

/** Принципал аутентифицированной сессии. */
export interface AuthenticatedUser {
  subject: string;
  username: string;
  displayName: string;
  email?: string;
  roles: Role[];
}

/** Ответ `GET /api/v1/me`. Тело бэкенда шире, лишние поля не читаются. */
export interface MeResponse {
  subject: string;
  displayName: string;
  email: string;
  roles: Role[];
  id?: string;
  enabled?: boolean;
}
