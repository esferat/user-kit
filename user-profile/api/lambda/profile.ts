import type { RequestOption } from '@modern-js/plugin-bff/server';
import { useHonoContext } from '@modern-js/server-runtime';

import { backendFetch } from '@shared/api/backend';
import { safeAction, safeRead, type SafeActionResult, type SafeReadResult } from '@shared/lib';
import { profileDetailsSchema, type MeResponse, type ProfileDetails } from '@shared/model';

/** Данные правки профиля; тип совпадает со схемой zod из `shared/model`. */
type ProfileData = ProfileDetails;

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
 * `GET /profile-api/profile` — профиль текущей сессии. Cookie браузера уходят
 * в бэкенд как есть, токены в ответ не возвращаются.
 */
export async function get(): Promise<SafeReadResult<MeResponse>> {
  return safeRead(async () => {
    const response = await backendFetch('/api/v1/me', incomingCookie());
    if (!response.ok) {
      throw new Error(await failureOf(response));
    }
    return (await response.json()) as MeResponse;
  });
}

/**
 * `PATCH /profile-api/profile` — правка базовых данных. Тело проходит через
 * safeAction: zod-валидация на сервере и единый результат вместо исключений.
 * В бэкенд уходят только два редактируемых поля, остальные он отвергает как
 * read-only.
 */
export async function patch({
  data,
}: RequestOption<never, ProfileData>): Promise<
  SafeActionResult<MeResponse, ProfileDetails>
> {
  return safeAction(profileDetailsSchema, data, async (value) => {
    const response = await backendFetch('/api/v1/me', incomingCookie(), {
      method: 'PATCH',
      body: JSON.stringify({ displayName: value.displayName, email: value.email }),
    });
    if (!response.ok) {
      throw new Error(await failureOf(response));
    }
    return (await response.json()) as MeResponse;
  });
}
