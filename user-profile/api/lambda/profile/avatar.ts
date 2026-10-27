import { useHonoContext } from '@modern-js/server-runtime';

import { backendFetch } from '@shared/api/backend';
import { BackendRefusal } from '@shared/api/errors';
import { logFailure } from '@shared/api/logger';
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
 * Возвращает настоящее `FormData` для переноса в бэкенд.
 *
 * Клиент присылает обычный `FormData`, но Hono разбирает multipart-тело **до**
 * хендлера (`c.req.parseBody()` в `getHonoInput`), и в аргумент приходит
 * плоский объект с null-prototype — так hono защищает от `__proto__`-ключей.
 * Прямой такой объект в `fetch` не сериализуется и падает с «Cannot convert
 * object to primitive value», поэтому поля перекладываются в настоящий
 * `FormData`: имена полей и файлы (вместе с именем файла) сохраняются.
 * `req.raw.formData()` здесь недоступен — тело уже прочитано Hono.
 */
function toFormData(parsed: FormData | Record<string, unknown>): FormData {
  if (parsed instanceof FormData) {
    return parsed;
  }
  const form = new FormData();
  for (const [name, value] of Object.entries(parsed)) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (entry instanceof Blob) {
        form.append(name, entry);
      } else if (entry !== undefined && entry !== null) {
        form.append(name, String(entry));
      }
    }
  }
  return form;
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
    throw new BackendRefusal(await failureOf(response));
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
  // Тип параметра — FormData, как у клиента; на сервере Hono уже разобрал
  // тело, поэтому форма приводится обратно (см. toFormData).
  return safeRead(
    () => forwardAvatar('POST', toFormData(formData)),
    logFailure('POST /profile-api/profile/avatar failed'),
  );
}

/**
 * `DELETE /profile-api/profile/avatar` — снятие аватара.
 *
 * Имя экспорта задаёт HTTP-метод, но `delete` нельзя использовать: генератор
 * клиентской части BFF выдаёт `export var delete`, а это ошибка синтаксиса.
 * Короткое `del` серверная часть Modern.js тоже читает как `DELETE`.
 */
async function deleteHandler(): Promise<SafeReadResult<MeResponse>> {
  return safeRead(
    () => forwardAvatar('DELETE', null),
    logFailure('DELETE /profile-api/profile/avatar failed'),
  );
}

export { postHandler as post, deleteHandler as del };
