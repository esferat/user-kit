import { useHonoContext } from '@modern-js/server-runtime';

import { backendFetch } from '@shared/api/backend';
import { safeRead, type SafeReadResult } from '@shared/lib';
import { type MeResponse } from '@shared/model';

/** Cookie входящего запроса: они уходят в бэкенд без изменений. */
function incomingCookie(): string | null {
  return useHonoContext().req.header('cookie') ?? null;
}

/** Причина отказа бэкенда в его же формате, если тело удалось разобрать. */
async function failureOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `Запрос к бэкенду завершился ошибкой (HTTP ${response.status}).`;
}

/**
 * Переносит запрос на аватар в бэкенд. Тело уходит как есть: для multipart
 * границу (boundary) приписывает fetch, поэтому `Content-Type` не ставится.
 */
async function forwardAvatar(method: string, body: BodyInit | null): Promise<MeResponse> {
  const response = await backendFetch('/api/v1/me/avatar', incomingCookie(), {
    method,
    body,
    rawBody: true,
  });
  if (!response.ok) {
    throw new Error(await failureOf(response));
  }
  return (await response.json()) as MeResponse;
}

/**
 * `POST /profile-api/profile/avatar` — загрузка аватара. Поле называется
 * `file`, как требует `MeController`; уменьшение и две версии делает бэкенд.
 */
async function postHandler({
  formData,
}: {
  formData: FormData;
}): Promise<SafeReadResult<MeResponse>> {
  return safeRead(() => forwardAvatar('POST', formData));
}

/**
 * `DELETE /profile-api/profile/avatar` — снятие аватара.
 *
 * Имя экспорта задаёт HTTP-метод, но `delete` нельзя использовать: генератор
 * клиентской части BFF выдаёт `export var delete`, а это ошибка синтаксиса.
 * Короткое `del` серверная часть Modern.js тоже читает как `DELETE`.
 */
async function deleteHandler(): Promise<SafeReadResult<MeResponse>> {
  return safeRead(() => forwardAvatar('DELETE', null));
}

export { postHandler as post, deleteHandler as del };
