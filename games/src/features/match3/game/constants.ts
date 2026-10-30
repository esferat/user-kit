export const GRID_SIZE = 10;
export const TILE_SIZE = 80;
export const BALL_RADIUS = TILE_SIZE / 2 - 8;
/** Шесть цветов: уровни сложности используют первые 4, 5 или 6 из них. */
export const COLORS = [0x4dabf7, 0xff6b6b, 0x51cf66, 0xffe066, 0xcc5de8, 0xff922b];
export const FALL_DURATION = 200;
/** Задержка волны взрыва бомбы на одну клетку расстояния от центра. */
export const BLAST_WAVE_MS = 48;
export const EMPTY_KEYS: ReadonlySet<string> = new Set();

/** Индекс цвета в палитре → цвет Phaser. */
export const paletteColor = (index: number): number => COLORS[index] ?? 0xffffff;
