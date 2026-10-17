import type { MeResponse } from '@/entities/user';
import { joinUrl, requestJson } from '@/shared/api';

/** Базовые данные профиля, которые можно править. */
export interface ProfileDetails {
  displayName: string;
  email: string;
}

export interface ProfileApiOptions {
  baseUrl: string;
}

export interface ProfileApi {
  /** `PATCH /api/v1/me`: бэкенд помечает профиль как ведомый приложением. */
  update(details: ProfileDetails): Promise<MeResponse>;
  /** `POST /api/v1/me/avatar`: файл, из него бэкенд делает две версии. */
  uploadAvatar(file: File): Promise<MeResponse>;
  /** `DELETE /api/v1/me/avatar`. */
  removeAvatar(): Promise<MeResponse>;
}

/**
 * Профиль текущей сессии. Cookie httpOnly ставит бэкенд, поэтому здесь нет
 * заголовка `Authorization`, а CSRF-токен добавляет общий `request`.
 */
export function createProfileApi(options: ProfileApiOptions): ProfileApi {
  const { baseUrl } = options;
  const meUrl = joinUrl(baseUrl, '/api/v1/me');
  const avatarUrl = joinUrl(baseUrl, '/api/v1/me/avatar');

  return {
    update: (details) =>
      requestJson<MeResponse>(meUrl, {
        method: 'PATCH',
        body: JSON.stringify(details),
      }),
    uploadAvatar: (file) => {
      const form = new FormData();
      form.append('file', file);
      return requestJson<MeResponse>(avatarUrl, {
        method: 'POST',
        body: form,
        rawBody: true,
      });
    },
    removeAvatar: () => requestJson<MeResponse>(avatarUrl, { method: 'DELETE' }),
  };
}
