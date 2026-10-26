import { patch } from '@api/profile';
import { del as deleteHandler, post as uploadHandler } from '@api/profile/avatar';

import type { SafeActionResult, SafeReadResult } from '@shared/lib';
import { type MeResponse, type ProfileDetails } from '@shared/model';

/**
 * Правка базовых данных. Вызов уходит в BFF-роут того же Origin: браузер
 * прикладывает cookie сессии сам, а CSRF-заголовок поднимает серверный прокси.
 */
export function updateProfile(
  data: ProfileDetails,
): Promise<SafeActionResult<MeResponse, ProfileDetails>> {
  return patch({ data });
}

/** `POST` аватара: файл уходит как есть, две версии делает бэкенд. */
export function uploadAvatar(file: File): Promise<SafeReadResult<MeResponse>> {
  const formData = new FormData();
  // Имя поля `file` законтракчено с `MeController`.
  formData.append('file', file);
  return uploadHandler({ formData });
}

/** `DELETE` аватара. */
export function removeAvatar(): Promise<SafeReadResult<MeResponse>> {
  return deleteHandler();
}
