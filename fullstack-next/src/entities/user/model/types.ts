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
  /** Полный аватар для страницы профиля; `null`, пока аватар не загружен. */
  avatarUrl?: string | null;
  /** Миниатюра для меню профиля; `null`, пока аватар не загружен. */
  avatarThumbnailUrl?: string | null;
}

/** Ответ `GET /api/v1/me`. Тело бэкенда шире, лишние поля не читаются. */
export interface MeResponse {
  subject: string;
  displayName: string;
  email: string;
  roles: Role[];
  id?: string;
  enabled?: boolean;
  username?: string;
  version?: number;
  etag?: string;
  avatarUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  avatarUpdatedAt?: string | null;
}
