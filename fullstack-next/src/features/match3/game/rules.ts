import {
  BombModel,
  LightningModel,
  RainbowModel,
  cellColor,
  type CellModel,
  type LightningOrientation,
} from '../model';

import { EMPTY_KEYS, GRID_SIZE } from './constants';

/** Позиция клетки на поле: строка и колонка. */
export interface Pos {
  r: number;
  c: number;
}

/** Модели клеток поля: строка сетки, `null` — пустая ячейка. */
export type CellGrid = (CellModel | null)[][];

/** Цепочка совпадений одного цвета: направление и клетки, из которых она состоит. */
export interface Run {
  dir: 'h' | 'v';
  color: number;
  cells: Pos[];
}

/** Сработавшая молния: позиция и линия, которую она очищает. */
export interface LightningActivation {
  pos: Pos;
  orientation: LightningOrientation;
}

/** Сработавший взрыв бомбы: центр и радиус его зоны. */
export interface BlastActivation {
  pos: Pos;
  radius: number;
}

export function keyOf(pos: Pos): string {
  return `${pos.r},${pos.c}`;
}

export function parseKey(key: string): Pos {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

/** Все горизонтальные и вертикальные цепочки из трёх и более одинаковых цветов. */
export function findRuns(grid: CellGrid): Run[] {
  const colorAt = (r: number, c: number): number | null => {
    const cell = grid[r][c];
    return cell ? cellColor(cell) : null;
  };
  const runs: Run[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    let c = 0;
    while (c < GRID_SIZE) {
      const color = colorAt(r, c);
      let end = c + 1;
      if (color !== null) {
        while (end < GRID_SIZE && colorAt(r, end) === color) end++;
        if (end - c >= 3) {
          const cells: Pos[] = [];
          for (let i = c; i < end; i++) cells.push({ r, c: i });
          runs.push({ dir: 'h', color, cells });
        }
      }
      c = end;
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    let r = 0;
    while (r < GRID_SIZE) {
      const color = colorAt(r, c);
      let end = r + 1;
      if (color !== null) {
        while (end < GRID_SIZE && colorAt(end, c) === color) end++;
        if (end - r >= 3) {
          const cells: Pos[] = [];
          for (let i = r; i < end; i++) cells.push({ r: i, c });
          runs.push({ dir: 'v', color, cells });
        }
      }
      r = end;
    }
  }
  return runs;
}

/**
 * Планирует новые особые элементы по правилам:
 * 5+ в ряд — радужный элемент, ровно 4 в ряд — молния
 * (горизонтальный ряд даёт молнию строки, вертикальный — столбца),
 * 5 и больше не в ряд (пересечение горизонтали и вертикали) — бомба.
 */
export function planSpecials(
  grid: CellGrid,
  runs: readonly Run[],
  preferred: readonly Pos[],
): Map<string, CellModel> {
  const creations = new Map<string, CellModel>();
  const used = new Set<string>();

  const pickAnchor = (cells: readonly Pos[]): string | null => {
    // Якорем может стать только обычный шарик: спецэлемент не должен
    // затирать другой спецэлемент без активации.
    const keys = cells
      .filter((cell) => grid[cell.r][cell.c]?.kind === 'ball')
      .map(keyOf);
    for (const pos of preferred) {
      const key = keyOf(pos);
      if (keys.includes(key) && !used.has(key)) return key;
    }
    const middle = keys[Math.floor(keys.length / 2)];
    if (middle && !used.has(middle)) return middle;
    return keys.find((key) => !used.has(key)) ?? null;
  };

  const register = (anchor: string | null, model: CellModel): void => {
    if (!anchor) return;
    creations.set(anchor, model);
    used.add(anchor);
  };

  // 5 и более в ряд → радужный элемент.
  runs
    .filter((run) => run.cells.length >= 5)
    .forEach((run) => register(pickAnchor(run.cells), new RainbowModel()));

  // Ровно 4 в ряд → молния: горизонталь «убирает» строку, вертикаль — столбец.
  runs
    .filter((run) => run.cells.length === 4)
    .forEach((run) =>
      register(pickAnchor(run.cells), new LightningModel(run.color, run.dir === 'h' ? 'row' : 'col')),
    );

  // 5 и больше не в ряд → бомба на пересечении горизонтали и вертикали.
  if (creations.size === 0) {
    const horizontal = new Set<string>();
    const vertical = new Set<string>();
    for (const run of runs) {
      const target = run.dir === 'h' ? horizontal : vertical;
      run.cells.forEach((cell) => target.add(keyOf(cell)));
    }
    const preferredKeys = new Set(preferred.map(keyOf));
    const intersections = [...horizontal]
      .filter((key) => vertical.has(key))
      .sort((x, y) => Number(preferredKeys.has(y)) - Number(preferredKeys.has(x)));
    for (const key of intersections) {
      if (used.has(key)) continue;
      const pos = parseKey(key);
      const cell = grid[pos.r][pos.c];
      if (cell?.kind !== 'ball') continue;
      register(key, new BombModel(cell.color));
    }
  }

  return creations;
}

/**
 * Расширяет набор очищаемых клеток активациями спецэлементов:
 * бомба добавляет клетки в радиусе взрыва, молния — всю свою строку
 * или столбец. Активации цепные: взрыв может подрядить соседнюю бомбу
 * или молнию. Клетки из `protectedKeys` (будущие особые элементы) не очищаются.
 * Сработавшие молнии записываются в `lightningFx` для эффекта по линии,
 * сработавшие бомбы — в `blasts` для волны взрыва от центра к краю.
 */
export function expandClears(
  grid: CellGrid,
  base: Iterable<string>,
  protectedKeys: ReadonlySet<string>,
  consumed: ReadonlySet<string> = EMPTY_KEYS,
  lightningFx?: LightningActivation[],
  blasts?: BlastActivation[],
): Set<string> {
  const result = new Set<string>();
  const queue: string[] = [];
  const add = (r: number, c: number, power = true): void => {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;
    const key = `${r},${c}`;
    if (protectedKeys.has(key) || result.has(key)) return;
    result.add(key);
    if (power) queue.push(key);
  };
  for (const key of base) {
    const pos = parseKey(key);
    // Участники комбо из `consumed` очищаются, но не срабатывают повторно.
    add(pos.r, pos.c, !consumed.has(key));
  }
  while (queue.length > 0) {
    const key = queue.pop();
    if (!key) break;
    const pos = parseKey(key);
    const cell = grid[pos.r][pos.c];
    if (!cell) continue;
    if (cell.kind === 'bomb') {
      blasts?.push({ pos, radius: cell.blastRadius });
      const radius = cell.blastRadius;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.hypot(dr, dc) <= radius) add(pos.r + dr, pos.c + dc);
        }
      }
    } else if (cell.kind === 'lightning') {
      // Разряд молнии: линия очищается, эффект играется над разлетающимися осколками.
      lightningFx?.push({ pos, orientation: cell.orientation });
      for (let i = 0; i < GRID_SIZE; i++) {
        if (cell.orientation === 'row') add(pos.r, i);
        else add(i, pos.c);
      }
    }
  }
  return result;
}

/** Все занятые клетки в радиусе от точки (используется для объединения двух бомб). */
export function blastKeys(centerR: number, centerC: number, radius: number): Set<string> {
  const keys = new Set<string>();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (Math.hypot(r - centerR, c - centerC) <= radius) keys.add(`${r},${c}`);
    }
  }
  return keys;
}

/** Добавляет в набор клетки всей строки или столбца, проходящих через позицию. */
export function addLineKeys(target: Set<string>, pos: Pos, orientation: LightningOrientation): void {
  for (let i = 0; i < GRID_SIZE; i++) {
    if (orientation === 'row') target.add(`${pos.r},${i}`);
    else target.add(`${i},${pos.c}`);
  }
}

/**
 * Лента шириной 3 клетки вдоль линии молнии: для строки — три соседних
 * ряда, для столбца — три соседние колонки.
 */
export function bandKeys(pos: Pos, orientation: LightningOrientation): Set<string> {
  const keys = new Set<string>();
  for (let offset = -1; offset <= 1; offset++) {
    if (orientation === 'row') addLineKeys(keys, { r: pos.r + offset, c: pos.c }, 'row');
    else addLineKeys(keys, { r: pos.r, c: pos.c + offset }, 'col');
  }
  return keys;
}
