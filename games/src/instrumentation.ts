/**
 * Точка наблюдаемости Next.js: старт сервера и ошибки серверных запросов.
 *
 * Файл подхватывается сам (корень приложения или `src`), флагов не требует.
 * Логгер подгружается динамически и только в Node-runtime: edge-бандлу
 * `node:fs` недоступен. Формат строк — общий со всем стендом, см.
 * `shared/lib/logger`.
 */
import type { Instrumentation } from 'next';

/** Логгер серверной части; ленивый импорт — см. док модуля. */
async function loadLogger() {
  return import('./shared/lib/logger');
}

/** Вызывается один раз при старте каждого экземпляра Next.js. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  const { logger } = await loadLogger();
  logger.info({ runtime: process.env.NEXT_RUNTIME ?? 'nodejs' }, 'Next.js server started');
}

/**
 * Ошибка серверного запроса: падение рендера, роута или экшена. Наружу уходит
 * обычный ответ Next, в лог — причина со стекрейсом и контекст вызова.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  const { asError, logger } = await loadLogger();
  logger.error(
    {
      err: asError(error),
      method: request.method,
      path: request.path,
      route: context.routePath,
      type: context.routeType,
      router: context.routerKind,
      render: context.renderSource ?? null,
    },
    'Request failed',
  );
};
