/**
 * Серверный прокси BFF → бэкенд. Модуль импортируется только из api/lambda,
 * клиентский бандл сюда не попадает: здесь process.env и сеть контейнера.
 * Каждый вызов попадает в лог (`./logger`), формат строки — как у бэкенда.
 *
 * Запрос приходит с cookie браузера, и они уходят в бэкенд как есть — сессия
 * живёт на бэкенде, токены в браузер не возвращаются. CSRF-токен читается из
 * cookie запроса и повторяется в заголовке, который бэкенд требует для
 * изменяющих методов.
 */

import { asError, logger } from './logger';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://backend:8080';

/** Cookie, которую браузер отдаёт для чтения, и заголовок, который из неё делается. */
const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface BackendRequest {
  method?: string;
  body?: BodyInit | null;
  /** Признак multipart: Content-Type задаёт fetch, руками его ставить нельзя. */
  rawBody?: boolean;
  headers?: Record<string, string>;
}

/** Извлекает одно значение cookie из заголовка Cookie входящего запроса. */
export function readCookieHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  const prefix = `${name}=`;
  for (const entry of cookieHeader.split(';')) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

/**
 * Отправляет запрос в бэкенд, перенося cookie сессии и CSRF-токен.
 * `incomingCookie` — значение заголовка Cookie входящего BFF-запроса.
 */
export async function backendFetch(
  path: string,
  incomingCookie: string | null | undefined,
  request: BackendRequest = {},
): Promise<Response> {
  const method = request.method ?? 'GET';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(incomingCookie ? { Cookie: incomingCookie } : {}),
    ...request.headers,
  };

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    const token = readCookieHeader(incomingCookie, CSRF_COOKIE);
    if (token !== null) {
      headers[CSRF_HEADER] = token;
    }
  }

  if (request.body !== undefined && request.body !== null && request.rawBody !== true) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BACKEND_BASE_URL}${normalizedPath}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: request.body ?? null,
    });
    // Каждый вызов BFF виден в логе: статус и длительность — в контексте,
    // 5xx поднимается до error, 4xx остаётся обычным исходом запроса
    // (клиент получает его безопасной строкой).
    const context = {
      method,
      path: normalizedPath,
      status: response.status,
      ms: Date.now() - started,
    };
    if (response.status >= 500) {
      logger.error(context, 'Backend call failed');
    } else {
      logger.info(context, 'Backend call');
    }
    return response;
  } catch (cause) {
    // Транспортная ошибка (бэкенд недоступен, DNS, таймаут): наружу уходит
    // человеческая причина, а не «fetch failed». В лог её пишет `logFailure`
    // роута, который ловит исключение, — одна причина даёт одну строку.
    const reason = asError(cause).message;
    throw new Error(`Бэкенд недоступен (${url}): ${reason}`, { cause });
  }
}
