import {
  DEFAULT_SETTINGS,
  LINES_DIFFICULTIES,
  type LinesDifficulty,
  type LinesSettings,
} from './constants';

/** Ключ localStorage, под которым хранятся настройки игры. */
export const SETTINGS_STORAGE_KEY = 'lines:settings';

/** Известная ли это сложность (защита от мусора в хранилище). */
function isDifficulty(value: unknown): value is LinesDifficulty {
  return typeof value === 'string' && (LINES_DIFFICULTIES as readonly string[]).includes(value);
}

/** Громкость: конечное число в диапазоне 0..1. */
function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Читает сохранённые настройки из localStorage. Возвращает `null`, если записи
 * нет, она повреждена или хранит неизвестную сложность. Отдельные недостающие
 * поля громкости берутся из значений по умолчанию.
 */
export function loadSettings(): LinesSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const {difficulty, musicVolume, sfxVolume} = parsed as {
      difficulty?: unknown;
      musicVolume?: unknown;
      sfxVolume?: unknown;
    };
    if (!isDifficulty(difficulty)) return null;
    return {
      difficulty,
      musicVolume: isVolume(musicVolume) ? musicVolume : DEFAULT_SETTINGS.musicVolume,
      sfxVolume: isVolume(sfxVolume) ? sfxVolume : DEFAULT_SETTINGS.sfxVolume,
    };
  } catch {
    return null;
  }
}

/**
 * Сохраняет настройки в localStorage. Ошибки доступа (приватный режим,
 * переполнение) глотаем: игра должна работать и без хранилища.
 */
export function saveSettings(settings: LinesSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        difficulty: settings.difficulty,
        musicVolume: settings.musicVolume,
        sfxVolume: settings.sfxVolume,
      }),
    );
  } catch {
    // Настройки просто не сохранятся — это не повод ломать игру.
  }
}
