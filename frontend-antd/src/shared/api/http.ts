export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiErrorBody {
  code?: string;
  message?: string;
  target?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? `http_${status}`;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface RequestOptions {
  method?: HttpMethod;
  body?: BodyInit | null;
  /** Указывается для multipart-загрузок; границу (boundary) генерирует браузер. */
  rawBody?: boolean;
  accept?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Бэкенд аутентифицирует браузер с помощью httpOnly cookie, поэтому здесь нечего
 * прикреплять: сам браузер отправляет cookie. Единственная читаемая cookie — это
 * CSRF-токен, который бэкенд ожидает в заголовке при каждой операции записи.
 */
const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

export function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const found = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return found === undefined ? null : decodeURIComponent(found.slice(prefix.length));
}

export function csrfHeaders(method: HttpMethod): Record<string, string> {
  if (SAFE_METHODS.has(method)) {
    return {};
  }
  const token = readCookie(CSRF_COOKIE);
  return token === null ? {} : { [CSRF_HEADER]: token };
}

export async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as ApiErrorBody;
    } catch {
      return null;
    }
  }
  return null;
}

export async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: options.accept ?? 'application/json',
    ...csrfHeaders(method),
    ...options.headers,
  };

  if (options.body !== undefined && options.body !== null && !options.rawBody) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ?? null,
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ApiError(response.status, body?.message ?? `Request failed with status ${response.status}`, body);
  }

  return response;
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(url, { ...options, accept: options.accept ?? 'application/json' });
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Склеивает базовый URL и путь без задвоения слэшей. */
export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/** Ответ списочного REST-ресурса: элементы текущей страницы и общее число совпадений. */
export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
