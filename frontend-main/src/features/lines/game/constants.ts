/**
 * Размеры поля «Цветных линий» в условных пикселях сцены.
 * При масштабе 1 единица сцены равна пикселю экрана.
 */

/** Поле статичное: 10×10 клеток. */
export const GRID_SIZE = 10;

/** Клетка — каменная плитка 100×100. */
export const CELL_SIZE = 100;

/** Отступ между клетками. */
export const CELL_GAP = 8;

/** Шаг сетки: клетка плюс отступ. */
export const CELL_PITCH = CELL_SIZE + CELL_GAP;

/** Ширина поля по клеткам (вместе с отступами): 10×100 + 9×8. */
export const BOARD_SIZE = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP;

/** Половина поля. */
export const BOARD_HALF = BOARD_SIZE / 2;

/** Высота плитки (рельеф камня). */
export const TILE_DEPTH = 8;

/** Ширина полосы-обрамления с растениями вокруг поля. */
export const FRAME_WIDTH = 96;

/** Половина сцены целиком: поле вместе с обрамлением. */
export const SCENE_HALF = BOARD_HALF + CELL_GAP / 2 + FRAME_WIDTH;

/** Наклон камеры: вид сверху под лёгким углом, градусы. */
export const CAMERA_TILT_DEG = 18;

/** Уровень сложности: задаёт число цветов и сколько шаров выпадает за ход. */
export type LinesDifficulty = 'easy' | 'medium' | 'hard' | 'insane';

/** Параметры сложности. */
export interface LinesLevel {
  /** Сколько шаров выпадает на поле после каждого хода. */
  ballsPerTurn: number;
  /** Сколько цветов шаров на поле. */
  colors: number;
}

/** Порядок уровней сложности в настройках. */
export const LINES_DIFFICULTIES: LinesDifficulty[] = ['easy', 'medium', 'hard', 'insane'];

/** Таблица сложностей: | сложность | шаров за ход | цветов |. */
export const LINES_LEVELS: Record<LinesDifficulty, LinesLevel> = {
  easy: { ballsPerTurn: 3, colors: 3 },
  medium: { ballsPerTurn: 4, colors: 4 },
  hard: { ballsPerTurn: 4, colors: 5 },
  insane: { ballsPerTurn: 5, colors: 5 },
};

/** Русские названия сложностей для настроек. */
export const DIFFICULTY_LABELS: Record<LinesDifficulty, string> = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная',
  insane: 'Очень сложная',
};

/** Настройки игры: сложность и громкости звука. */
export interface LinesSettings {
  difficulty: LinesDifficulty;
  /** Громкость фоновой музыки, 0..1. */
  musicVolume: number;
  /** Громкость звуковых эффектов, 0..1. */
  sfxVolume: number;
}

/** Настройки по умолчанию. */
export const DEFAULT_SETTINGS: LinesSettings = {
  difficulty: 'medium',
  musicVolume: 0.45,
  sfxVolume: 0.7,
};
