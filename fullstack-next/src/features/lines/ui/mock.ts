/** Мок-данные таблицы попыток: игра пока не считает результаты. */
export interface AttemptEntry {
  name: string;
  score: number;
}

export const MOCK_ATTEMPTS: AttemptEntry[] = [
  { name: 'Игрок 1', score: 2340 },
  { name: 'Игрок 2', score: 1875 },
  { name: 'Игрок 3', score: 1420 },
  { name: 'Игрок 4', score: 980 },
  { name: 'Игрок 5', score: 645 },
];
