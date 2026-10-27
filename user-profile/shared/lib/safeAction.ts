import { z } from 'zod';

/**
 * Безопасное действие: вход валидируется схемой zod, обработчик получает уже
 * проверенное значение, а наружу всегда уходит один дискриминированный
 * результат. Ошибки исключений сюда не просачиваются — вызывающий получает
 * только `serverError` с человеческой причиной.
 *
 * Аналог next-safe-action, но без привязки к Next.js: действие исполняется в
 * BFF-роуте (api/lambda), то есть на сервере. Падение обработчика можно отдать
 * на запись в лог необязательным `onError` — роуты передают туда `logFailure`
 * из `shared/api/logger`, сам модуль логгера сюда не импортируется.
 */
export type FieldErrors<Fields> = Partial<Record<keyof Fields & string, string[]>>;

export type SafeActionResult<Data, Fields> =
  | { data: Data; validationErrors: null; serverError: null }
  | { data: null; validationErrors: FieldErrors<Fields>; serverError: null }
  | { data: null; validationErrors: null; serverError: string };

/** Результат запроса без входных данных: данные либо причина отказа. */
export type SafeReadResult<Data> = { data: Data; error: null } | { data: null; error: string };

/** Собирает ошибки по первому уровню пути поля, как их ждёт react-hook-form. */
function fieldErrors(error: z.ZodError): FieldErrors<Record<string, unknown>> {
  const result: FieldErrors<Record<string, unknown>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    const bucket = (result[key] ??= []);
    if (!bucket.includes(issue.message)) {
      bucket.push(issue.message);
    }
  }
  return result;
}

/** Причина отказа, пригодная для показа человеку. */
function reasonOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback;
}

/**
 * Отдаёт причину снаружи — в лог BFF. Сам модуль логгера сюда не импортируется:
 * `safeAction`/`safeRead` выходит из `shared/lib/index.ts`, который клиент
 * импортирует значениями, а node:fs в клиентский граф не тащим.
 *
 * Сбой самого логирования не должен ломать безопасный контракт: ответ уходит
 * и без него.
 */
function report(onError: ((error: unknown) => void) | undefined, error: unknown): void {
  try {
    onError?.(error);
  } catch {
    // Логирование — побочный эффект, его сбой игнорируется.
  }
}

export async function safeAction<Schema extends z.ZodType, Data>(
  schema: Schema,
  input: unknown,
  handler: (value: z.infer<Schema>) => Promise<Data>,
  onError?: (error: unknown) => void,
): Promise<SafeActionResult<Data, z.infer<Schema>>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      validationErrors: fieldErrors(parsed.error) as FieldErrors<z.infer<Schema>>,
      serverError: null,
    };
  }

  try {
    const data = await handler(parsed.data);
    return { data, validationErrors: null, serverError: null };
  } catch (error) {
    report(onError, error);
    return {
      data: null,
      validationErrors: null,
      serverError: reasonOf(error, 'Не удалось выполнить действие.'),
    };
  }
}

/** Действие без входных данных: читает что-то и возвращает это или причину отказа. */
export async function safeRead<Data>(
  loader: () => Promise<Data>,
  onError?: (error: unknown) => void,
): Promise<SafeReadResult<Data>> {
  try {
    return { data: await loader(), error: null };
  } catch (error) {
    report(onError, error);
    return { data: null, error: reasonOf(error, 'Не удалось выполнить запрос.') };
  }
}

/** Правда, если действие вернуло данные. Типовая подсказка для вызывающего. */
export function isActionSuccess<Data, Fields>(
  result: SafeActionResult<Data, Fields>,
): result is Extract<SafeActionResult<Data, Fields>, { data: Data }> {
  return result.data !== null;
}
