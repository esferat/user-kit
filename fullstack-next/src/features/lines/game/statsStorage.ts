import { LINES_DIFFICULTIES, type LinesDifficulty } from './constants';

/** Ключ localStorage, под которым хранится таблица лучших попыток. */
export const STATS_STORAGE_KEY = 'lines:stats';

/** Сколько лучших попыток держим в таблице. */
export const MAX_ATTEMPTS = 5;

/** Одна сыгранная партия: попадает в таблицу лучших попыток. */
export interface AttemptEntry {
  /** Итоговый счёт партии. */
  score: number;
  /** Сложность, на которой играли. */
  difficulty: LinesDifficulty;
  /** Когда партия закончилась (мс, Unix time). */
  at: number;
}

/** Известная ли это сложность (защита от мусора в хранилище). */
function isDifficulty(value: unknown): value is LinesDifficulty {
  return typeof value === 'string' && (LINES_DIFFICULTIES as readonly string[]).includes(value);
}

/** Похожа ли запись на попытку: неотрицательный счёт, известная сложность, время. */
function isAttempt(value: unknown): value is AttemptEntry {
  if (!value || typeof value !== 'object') return false;
  const {score, difficulty, at} = value as {score?: unknown; difficulty?: unknown; at?: unknown};
  return (
    typeof score === 'number' &&
    Number.isFinite(score) &&
    score >= 0 &&
    isDifficulty(difficulty) &&
    typeof at === 'number' &&
    Number.isFinite(at)
  );
}

/** Порядок в таблице: сначала больше очков, при равенстве — раньше сыгранные. */
function byBest(a: AttemptEntry, b: AttemptEntry): number {
  return b.score - a.score || a.at - b.at;
}

/**
 * Читает лучшие попытки из localStorage. Пустой список — норма: игра
 * начинается без статистики. Повреждённые записи и ошибки доступа игнорируем.
 */
export function loadAttempts(): AttemptEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttempt).sort(byBest).slice(0, MAX_ATTEMPTS);
  } catch {
    return [];
  }
}

/** Сохраняет таблицу попыток; ошибки хранилища глотаем. */
function saveAttempts(attempts: AttemptEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Попытки просто не сохранятся — это не повод ломать игру.
  }
}

/**
 * Добавляет партию в таблицу лучших попыток и возвращает обновлённый список.
 * Держим только MAX_ATTEMPTS лучших, поэтому слабый результат может не попасть.
 */
export function recordAttempt(entry: AttemptEntry): AttemptEntry[] {
  const attempts = [...loadAttempts(), entry].sort(byBest).slice(0, MAX_ATTEMPTS);
  saveAttempts(attempts);
  return attempts;
}
