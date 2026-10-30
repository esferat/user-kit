/** Публичная конфигурация фронтенда. Секретов здесь быть не может. */
export interface AppConfig {
  /**
   * База REST API. Пустая строка означает same-origin: nginx на одном домене
   * проксирует `/api` на бэкенд, поэтому абсолютный адрес не нужен.
   */
  apiBaseUrl: string;
  /**
   * База микрофронтенда `user-profile` (remote Module Federation). Адрес другой
   * домен: remote отдаёт свой `mf-manifest.json` и чанки оттуда.
   */
  profileBaseUrl: string;
  /**
   * База отдельного проекта игр. Игры живут на своём домене и не требуют
   * сессии, меню только ведёт туда абсолютной ссылкой.
   */
  gamesBaseUrl: string;
}

/** Убирает хвостовой слэш, чтобы склейка путей не давала двойной слэш. */
export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

// NEXT_PUBLIC_* инлайнится компилятором на этапе сборки, поэтому обращение к
// переменной должно быть статичным, а не через объект окружения.
const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? '');

// Значение по умолчанию совпадает с SERVER_NAME_PROFILE edge-nginx: именно под
// этим доменом публикуется user-profile и отдаёт свои чанки.
const profileBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_PROFILE_BASE_URL ?? 'https://user-kit.profile.local',
);

// То же для домена игр: значение по умолчанию совпадает с SERVER_NAME_GAMES
// edge-nginx.
const gamesBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_GAMES_BASE_URL ?? 'https://user-kit.games.local',
);

export const appConfig: AppConfig = { apiBaseUrl, profileBaseUrl, gamesBaseUrl };
