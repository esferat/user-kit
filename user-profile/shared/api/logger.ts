/**
 * Серверный логгер BFF user-profile на Pino.
 *
 * Формат строки совпадает с бэкендом: `[LEVEL]-[yyyy-MM-dd HH:mm:ss.SSS]- message`
 * (`logging.pattern` в `backend/src/main/resources/application.yml`), стекрейс
 * идёт следующими строками — так же, как исключение печатает Logback. Строку
 * разбирает `vector/vector.toml`, поэтому форма меняется только вместе с ним.
 *
 * Модуль лежит в `shared/api` рядом с `backend.ts` (оба — только сервер) и,
 * как он, импортируется исключительно из `api/lambda` и этого же слоя: через
 * `shared/lib/index.ts` его выводить нельзя — клиентские файлы импортируют
 * тот индекс значениями, и узел node:fs в графе импортов сломал бы сборку.
 *
 * Переменные окружения: `LOG_FILE` — файл, который тилит Vector (в compose это
 * `/var/log/user-kit/user-profile.log`); без неё логи идут только в stdout.
 * `LOG_LEVEL` — уровень (по умолчанию `info`).
 */
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';

import pino from 'pino';

import { BackendRefusal } from './errors';

/** Одна запись в том JSON, который pino пишет в поток. */
type LogRecord = Record<string, unknown>;

/** Служебные поля pino; остальное — контекст события, он идёт в конце строки. */
const INTERNAL_KEYS: ReadonlySet<string> = new Set(['level', 'time', 'msg', 'err']);

/** Число с ведущими нулями: `pad(3, 2)` даёт `03`. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Момент времени в формате бэкенда, всегда UTC — как в контейнере бэкенда. */
function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
  const clock = `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`;
  return `${day} ${clock}.${pad(date.getUTCMilliseconds(), 3)}`;
}

/** Причина отказа одной строкой: лог не должен падать из-за неожиданного значения. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Контекст события (метод, путь, статус) — JSON в конце строки сообщения. */
function contextOf(record: LogRecord): string {
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!INTERNAL_KEYS.has(key) && value !== undefined) {
      context[key] = value;
    }
  }
  return Object.keys(context).length === 0 ? '' : ` ${JSON.stringify(context)}`;
}

/** Строки одного события: первая — шапка в формате бэкенда, следующие — стекрейс. */
function formatRecord(record: LogRecord): string {
  const level =
    typeof record.level === 'string' ? record.level.toUpperCase() : String(record.level);
  const time = typeof record.time === 'number' ? record.time : Date.now();
  const message = typeof record.msg === 'string' ? record.msg : String(record.msg ?? '');
  const err = record.err;
  const stack =
    typeof err === 'object' && err !== null ? (err as { stack?: unknown }).stack : undefined;

  const lines = [`[${level}]-[${formatTimestamp(time)}]- ${message}${contextOf(record)}`];
  if (typeof stack === 'string' && stack !== '') {
    lines.push(stack);
  }
  return lines.join('\n');
}

/** Открывает файл лога; сбой открытия не должен ронять сервер — только предупреждение. */
function openLogFile(target: string): WriteStream | null {
  try {
    mkdirSync(dirname(target), { recursive: true });
    const stream = createWriteStream(target, { flags: 'a' });
    stream.on('error', (error: Error) => {
      process.stderr.write(`logger: file ${target}: ${error.message}\n`);
    });
    return stream;
  } catch (error) {
    process.stderr.write(`logger: cannot open ${target}: ${messageOf(error)}\n`);
    return null;
  }
}

/**
 * Приёмник pino: разбирает JSON-строку и пишет строку в формате бэкенда
 * в stdout и, если задан `LOG_FILE`, в файл для Vector. Метод `write`
 * обязателен для `pino.DestinationStream`, `flushSync` — для `logger.flush()`.
 */
function createSink(target: string | undefined): pino.DestinationStream & { flushSync(): void } {
  const file = target ? openLogFile(target) : null;

  // pino отдаёт запись целиком, но буфер защищает от частичной строки.
  let pending = '';

  const emit = (raw: string): void => {
    if (raw === '') {
      return;
    }
    let text: string;
    try {
      text = formatRecord(JSON.parse(raw) as LogRecord);
    } catch {
      // Не наш JSON — отдаём строку как есть, чтобы не потерять событие.
      text = raw;
    }
    try {
      process.stdout.write(`${text}\n`);
      file?.write(`${text}\n`);
    } catch (error) {
      // Лог — побочный эффект: его сбой не должен ронять сервер.
      process.stderr.write(`logger: write failed: ${messageOf(error)}\n`);
    }
  };

  return {
    write(chunk: string): void {
      pending += chunk;
      let end = pending.indexOf('\n');
      while (end !== -1) {
        emit(pending.slice(0, end));
        pending = pending.slice(end + 1);
        end = pending.indexOf('\n');
      }
    },
    flushSync(): void {
      // Писать в файл приходится построчными записями, сбрасывать нечего.
    },
  };
}

const sink = createSink(process.env.LOG_FILE);

/** Логгер BFF; см. док модуля о формате и о том, почему не через index. */
export const logger = pino(
  {
    // Без pid и hostname: строка должна выглядеть как строка бэкенда.
    base: null,
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
      // Уровень словом в верхнем регистре — как `%level` в Logback.
      level: (label) => ({ level: label.toUpperCase() }),
    },
  },
  sink,
);

/**
 * Приводит любую причину к `Error`: сериализатору pino нужны message и stack,
 * а стекрейс — это строки события под шапкой, как исключение у бэкенда.
 */
export function asError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value) ?? String(value));
  } catch {
    return new Error('Unserializable error');
  }
}

/**
 * Обработчик `onError` для `safeAction`/`safeRead`: причина падения BFF-роута
 * уходит в лог, клиент получает только безопасную строку результата.
 *
 * `scope` — что это за роут, он попадает в текст события.
 */
export function logFailure(scope: string): (error: unknown) => void {
  return (error: unknown) => {
    // Отказ бэкенда (401 без сессии, 422 на нарушение контракта, ...) — штатный
    // исход: его код ответа уже залогирован строкой `Backend call`, а причина
    // уходит на debug, чтобы error не зашумлялся анонимными визитами.
    if (error instanceof BackendRefusal) {
      logger.debug({ reason: asError(error).message }, scope);
      return;
    }
    logger.error({ err: asError(error) }, scope);
  };
}
