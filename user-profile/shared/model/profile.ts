import { z } from 'zod';

/** Роли бэкенда ровно две; право проверяет сервер, клиент только прячет UI. */
export const ROLES = ['admin', 'user'] as const;

export type Role = (typeof ROLES)[number];

export const roleSchema = z.enum(ROLES);

/**
 * Редактируемая часть профиля. Схема одна на клиенте (react-hook-form) и на
 * сервере (safe-action в BFF), поэтому правило валидации не расходится.
 */
export const profileDetailsSchema = z.object({
  displayName: z.string().trim().min(1, 'Укажите имя').max(255, 'Не более 255 символов'),
  email: z.email('Некорректная почта').or(z.literal('')),
});

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;

/** Ответ `GET /api/v1/me`. Тело бэкенда шире, лишние поля не читаются. */
export interface MeResponse {
  subject: string;
  displayName: string;
  email: string;
  roles: Role[];
  username?: string;
  enabled?: boolean;
  version?: number;
  /** Текущая версия профиля для `If-Match`. */
  etag?: string;
  avatarUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  avatarUpdatedAt?: string | null;
}

/** Принципал сессии, как его показывает страница. */
export interface AuthenticatedUser {
  subject: string;
  username: string;
  displayName: string;
  email?: string;
  roles: Role[];
  avatarUrl?: string | null;
  avatarThumbnailUrl?: string | null;
}

/** Собирает из ответа бэкенда то, что рисует UI. */
export function toAuthenticatedUser(me: MeResponse): AuthenticatedUser {
  return {
    subject: me.subject,
    username: me.username ?? me.subject,
    displayName: me.displayName,
    email: me.email,
    roles: me.roles,
    avatarUrl: me.avatarUrl ?? null,
    avatarThumbnailUrl: me.avatarThumbnailUrl ?? null,
  };
}
