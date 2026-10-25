import {GRID_SIZE, LINES_LEVELS, type LinesDifficulty} from './constants';
import {makeRng, type Rng} from './random';

/** Пустая клетка. */
export const EMPTY = -1;

/** Минимальная длина линии для списания. */
export const LINE_LENGTH = 5;

/** Статус партии. */
export type LinesStatus = 'playing' | 'over';

/** Состояние партии. */
export interface LinesState {
  size: number;
  difficulty: LinesDifficulty;
  /** Цвет шара (индекс палитры) в клетке или EMPTY. */
  board: number[];
  score: number;
  /** Цвета шаров следующего броска — совпадают с панелью «Дальше». */
  nextColors: number[];
  /** Клетки под будущими шарами: заняты под спавн, ходить по ним нельзя. */
  nextCells: number[];
  status: LinesStatus;
  /** Зерно ГСЧ: партия детерминирована по seed. */
  seed: number;
}

/** Что произошло за ход — для анимаций и подсчёта очков. */
export interface MoveOutcome {
  state: LinesState;
  /** Клетки, из которых шары сняты (анимация исчезновения). */
  cleared: number[];
  /** Клетки, куда упали новые шары (анимация появления); при списании пусто. */
  spawned: number[];
  /** Очки, заработанные за ход. */
  gained: number;
  /**
   * Списание даёт дополнительный ход: бросок не делается — новые шары не падают,
   * предсказание остаётся прежним, игрок ходит ещё раз.
   */
  bonus: boolean;
}

/** Шаги ортогонального перемещения шара. */
const STEPS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Оси проверки линий: горизонталь, вертикаль и обе диагонали. */
const AXES: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Случайные разные клетки среди пустых (не больше, чем пустых). */
function pickCells(board: number[], count: number, rng: Rng): number[] {
  const empty: number[] = [];
  for (let cell = 0; cell < board.length; cell += 1) {
    if (board[cell] === EMPTY) empty.push(cell);
  }
  for (let i = empty.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  return empty.slice(0, count);
}

/** Линии из шаров одного цвета длиной не меньше LINE_LENGTH, проходящие через клетку. */
export function linesThrough(board: number[], size: number, cell: number): number[][] {
  const color = board[cell];
  if (color === EMPTY) return [];
  const row = Math.floor(cell / size);
  const col = cell % size;
  const lines: number[][] = [];
  for (const [dr, dc] of AXES) {
    const run = [cell];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === color) {
        run.push(r * size + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= LINE_LENGTH) lines.push(run);
  }
  return lines;
}

/**
 * Маршрут шара из клетки `from` в клетку `to`: вертикально и горизонтально
 * через свободные клетки. Маленькие шарики предсказания ходу не мешают —
 * они лишь показывают, куда упадут новые шары.
 * Если пути нет — null.
 */
export function findPath(state: LinesState, from: number, to: number): number[] | null {
  const {board, size} = state;
  if (from === to || board[from] === EMPTY) return null;
  if (board[to] !== EMPTY) return null;

  const passable = (cell: number) => board[cell] === EMPTY;

  const prev = new Int32Array(size * size).fill(-1);
  prev[from] = from;
  const queue = [from];
  while (queue.length > 0) {
    const cell = queue.shift() as number;
    if (cell === to) break;
    const row = Math.floor(cell / size);
    const col = cell % size;
    for (const [dr, dc] of STEPS) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const next = r * size + c;
      if (prev[next] !== -1) continue;
      if (next !== to && !passable(next)) continue;
      prev[next] = cell;
      queue.push(next);
    }
  }
  if (prev[to] === -1) return null;

  const path: number[] = [];
  for (let cur = to; cur !== from; cur = prev[cur]) path.push(cur);
  path.push(from);
  path.reverse();
  return path;
}

/** Длина самой длинной линии одного цвета через клетку (по тем же осям, что и списание). */
function runThrough(board: number[], size: number, cell: number): number {
  const color = board[cell];
  if (color === EMPTY) return 0;
  const row = Math.floor(cell / size);
  const col = cell % size;
  let best = 1;
  for (const [dr, dc] of AXES) {
    let length = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === color) {
        length += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (length > best) best = length;
  }
  return best;
}

/** Сколько шаров снимет клетка: объединение всех линий, проходящих через неё. */
function countClear(board: number[], size: number, cell: number): number {
  const lines = linesThrough(board, size, cell);
  if (lines.length === 0) return 0;
  const cells = new Set<number>();
  for (const line of lines) {
    for (const c of line) cells.add(c);
  }
  return cells.size;
}

/** Подсказка: полезный ход и маршрут до него. */
export interface LinesHint {
  from: number;
  to: number;
  path: number[];
  /** Сколько шаров спишется этим ходом: 0 — ход только готовит линию. */
  clears: number;
  /** Самая длинная линия через клетку прихода после хода: 1 — линии нет. */
  line: number;
}

/**
 * Полезный ход для сбора 5 шаров в линию. Приоритеты: ход со списанием, затем
 * ход свободным шаром (не стоящим в линии), который продолжает линию; в крайнем
 * случае — любой ход. При равенстве короче маршрут. `null` — партия окончена.
 */
export function findHint(state: LinesState): LinesHint | null {
  if (state.status !== 'playing') return null;
  const {board, size} = state;
  let best: {hint: LinesHint; weight: number} | null = null;

  for (let from = 0; from < board.length; from += 1) {
    const color = board[from];
    if (color === EMPTY) continue;
    // Линия, в которой шар стоит сейчас: если он «свободен», ход ничего не ломает.
    const fromLine = runThrough(board, size, from);
    for (let to = 0; to < board.length; to += 1) {
      if (board[to] !== EMPTY) continue;
      const path = findPath(state, from, to);
      if (!path || path.length < 2) continue;

      const moved = board.slice();
      moved[from] = EMPTY;
      moved[to] = color;
      const line = runThrough(moved, size, to);
      const clears = countClear(moved, size, to);

      // Списание — лучший ход. Иначе предпочитаем свободный шар, который
      // продолжает линию: нельзя предлагать шар, ломающий свою же линию.
      const buildsLine = fromLine === 1 && line >= 2;
      const weight =
        clears > 0
          ? 4_000_000 + clears * 1000 + line
          : (buildsLine ? 3_000_000 : 1_000_000) + line * 1000;

      if (
        !best ||
        weight > best.weight ||
        (weight === best.weight && path.length < best.hint.path.length)
      ) {
        best = {hint: {from, to, path, clears, line}, weight};
      }
    }
  }
  return best?.hint ?? null;
}

/** Есть ли хотя бы один возможный ход: хоть один шар имеет свободную соседнюю клетку. */
export function canMoveAny(board: number[], size: number): boolean {
  for (let cell = 0; cell < board.length; cell += 1) {
    if (board[cell] === EMPTY) continue;
    const row = Math.floor(cell / size);
    const col = cell % size;
    for (const [dr, dc] of STEPS) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (board[r * size + c] === EMPTY) return true;
    }
  }
  return false;
}

/** Случайная свободная клетка, кроме перечисленных; EMPTY, если свободных нет. */
function pickFreeCell(board: number[], exclude: Set<number>, rng: Rng): number {
  const free: number[] = [];
  for (let cell = 0; cell < board.length; cell += 1) {
    if (board[cell] === EMPTY && !exclude.has(cell)) free.push(cell);
  }
  if (free.length === 0) return EMPTY;
  return free[Math.floor(rng() * free.length)];
}

/** Очки за собранные шары: база плюс надбавка за длину линии и за несколько линий сразу. */
function scoreFor(balls: number, lines: number): number {
  return balls * 10 + Math.max(0, balls - LINE_LENGTH) * 10 + (lines - 1) * 50;
}

/** Следующий бросок: цвета и клетки под будущими шарами среди пустых клеток. */
function rollNext(board: number[], levelBallsPerTurn: number, colors: number, rng: Rng) {
  const cells = pickCells(board, levelBallsPerTurn, rng);
  const nextColors = cells.map(() => Math.floor(rng() * colors));
  return {cells, nextColors};
}

/** Новая партия: на пустом поле n шаров случайных цветов плюс первый предпросмотр. */
export function createGame(difficulty: LinesDifficulty, seed: number = Date.now()): LinesState {
  const size = GRID_SIZE;
  const level = LINES_LEVELS[difficulty];
  const rng = makeRng(seed);
  const board = new Array<number>(size * size).fill(EMPTY);
  for (const cell of pickCells(board, level.ballsPerTurn, rng)) {
    board[cell] = Math.floor(rng() * level.colors);
  }
  const next = rollNext(board, level.ballsPerTurn, level.colors, rng);
  return {
    size,
    difficulty,
    board,
    score: 0,
    nextColors: next.nextColors,
    nextCells: next.cells,
    status: 'playing',
    seed,
  };
}

/**
 * Ход: шар едет по маршруту, затем списываются линии через его клетку.
 * Списание даёт дополнительный ход: бросок пропускается — новые шары не падают,
 * предсказание остаётся прежним. Если списания не было, на клетки предсказания
 * падают новые шары (при занятой клетке — на случайную свободную; их линии
 * тоже списываются) и выбирается следующее предсказание.
 * Если ходить некуда — статус «over».
 */
export function applyMove(state: LinesState, from: number, to: number): MoveOutcome {
  const size = state.size;
  const level = LINES_LEVELS[state.difficulty];
  const rng = makeRng(state.seed);
  const board = state.board.slice();
  let gained = 0;
  const cleared = new Set<number>();

  // Списание линий, проходящих через клетку `cell`.
  const clearLines = (cell: number) => {
    const lines = linesThrough(board, size, cell);
    if (lines.length === 0) return;
    const cells = new Set<number>();
    for (const line of lines) {
      for (const c of line) cells.add(c);
    }
    for (const c of cells) board[c] = EMPTY;
    for (const c of cells) cleared.add(c);
    gained += scoreFor(cells.size, lines.length);
  };

  board[to] = board[from];
  board[from] = EMPTY;
  clearLines(to);

  const bonus = cleared.size > 0;
  const spawned: number[] = [];
  let nextCells = state.nextCells;
  let nextColors = state.nextColors;

  if (!bonus) {
    // Спавн предсказания: цвета и клетки совпадают с панелью «Дальше».
    // Если клетку занял шар — предсказание падает на случайную свободную клетку.
    for (let i = 0; i < state.nextCells.length; i += 1) {
      let cell = state.nextCells[i];
      if (board[cell] !== EMPTY) {
        cell = pickFreeCell(board, new Set(state.nextCells.slice(i + 1)), rng);
        if (cell === EMPTY) continue; // свободных клеток не осталось
      }
      board[cell] = state.nextColors[i];
      spawned.push(cell);
      clearLines(cell);
    }
    const next = rollNext(board, level.ballsPerTurn, level.colors, rng);
    nextCells = next.cells;
    nextColors = next.nextColors;
  }

  const hasBalls = board.some((color) => color !== EMPTY);
  const status = hasBalls && !canMoveAny(board, size) ? 'over' : 'playing';

  return {
    state: {
      size,
      difficulty: state.difficulty,
      board,
      score: state.score + gained,
      nextColors,
      nextCells,
      status,
      seed: (state.seed + 0x9e3779b9) >>> 0,
    },
    cleared: [...cleared],
    spawned,
    gained,
    bonus,
  };
}
