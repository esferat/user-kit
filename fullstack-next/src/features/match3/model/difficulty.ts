export type DifficultyKey = 'easy' | 'medium' | 'hard';

export interface Difficulty {
  key: DifficultyKey;
  label: string;
  /** Сколько цветов шариков используется на этом уровне. */
  colors: number;
}

/** Уровни сложности: лёгкий — 4 цвета, средний — 5, сложный — 6. */
export const DIFFICULTIES: readonly Difficulty[] = [
  { key: 'easy', label: 'Лёгкий', colors: 4 },
  { key: 'medium', label: 'Средний', colors: 5 },
  { key: 'hard', label: 'Сложный', colors: 6 },
];

export const DEFAULT_DIFFICULTY: Difficulty = DIFFICULTIES[0];
