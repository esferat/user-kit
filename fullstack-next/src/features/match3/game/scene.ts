import { message } from 'antd';
import Phaser from 'phaser';

import { BallModel, BombModel, cellColor, type CellModel, type LightningModel } from '../model';
import { BALL_RADIUS, EMPTY_KEYS, FALL_DURATION, GRID_SIZE, TILE_SIZE, paletteColor } from './constants';
import {
  drawBomb,
  drawCrystal,
  drawLightning,
  drawRainbow,
  hexToUnitRgb,
  strokeBolt,
  type BoltPoint,
} from './drawing';
import {
  addLineKeys,
  bandKeys,
  blastKeys,
  expandClears,
  findRuns,
  keyOf,
  parseKey,
  planSpecials,
  type LightningActivation,
  type Pos,
} from './rules';
import {
  LIGHTNING_STRIKE_FRAG,
  LIGHTNING_TILE_FRAG,
  STRIKE_DURATION_MS,
  nextShaderName,
} from './shaders';

/**
 * Плитка — Graphics или шейдерный объект (молнии рисуются шейдером
 * при наличии WebGL). Оба варианта двигаются и анимируются одинаково.
 */
type Tile = (Phaser.GameObjects.Graphics | Phaser.GameObjects.Shader) & {
  r: number;
  c: number;
};

interface TweenItem {
  obj: Tile;
  x?: number;
  y?: number;
  alpha?: number;
}

export class Match3Scene extends Phaser.Scene {
  private readonly onScoreChange: (score: number) => void;
  private colorCount: number;
  private grid: (CellModel | null)[][] = [];
  private tiles: Tile[][] = [];
  private selected: Tile | null = null;
  private selectionRing: Phaser.GameObjects.Graphics | null = null;
  private animating = false;
  private score = 0;
  /** WebGL доступен — молния рисуется шейдерами, иначе Graphics-фолбэк. */
  private webgl = false;

  constructor(onScoreChange: (score: number) => void, colorCount: number) {
    super({ key: 'Match3' });
    this.onScoreChange = onScoreChange;
    this.colorCount = colorCount;
  }

  create(): void {
    this.webgl = this.sys.game.renderer.type === Phaser.WEBGL;
    this.drawBoard();
    const grid = this.generateStableGrid();
    this.tiles = Array.from({ length: GRID_SIZE }, () => [] as Tile[]);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (cell) this.tiles[r][c] = this.createTile(r, c, cell);
      }
    }
  }

  /** Сброс поля: новая сетка без совпадений, счёт обнуляется. */
  resetGame(): void {
    if (this.animating) return;
    this.clearSelection();
    this.tiles.forEach((row) => row.forEach((tile) => tile?.destroy()));
    const grid = this.generateStableGrid();
    this.tiles = Array.from({ length: GRID_SIZE }, () => [] as Tile[]);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (cell) this.tiles[r][c] = this.createTile(r, c, cell);
      }
    }
    this.score = 0;
    this.onScoreChange(0);
  }

  /** Смена уровня сложности: другое число цветов и новое поле. */
  setDifficulty(colorCount: number): void {
    if (this.animating) return;
    this.colorCount = colorCount;
    this.resetGame();
  }

  private randomColorIndex(): number {
    return Math.floor(Math.random() * this.colorCount);
  }

  private createEmptyGrid(): (CellModel | null)[][] {
    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new BallModel(this.randomColorIndex())),
    );
  }

  /** Сетка без готовых совпадений — стартовое состояние поля. */
  private generateStableGrid(): (CellModel | null)[][] {
    this.grid = this.createEmptyGrid();
    while (findRuns(this.grid).length > 0) {
      this.grid = this.createEmptyGrid();
    }
    return this.grid;
  }

  private drawBoard(): void {
    const size = GRID_SIZE * TILE_SIZE;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a2130, 0x1a2130, 0x10141b, 0x10141b, 1);
    bg.fillRect(0, 0, size, size);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if ((r + c) % 2 === 0) {
          bg.fillStyle(0xffffff, 0.025);
          bg.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    bg.lineStyle(1, 0x2b3446, 1);
    for (let i = 1; i < GRID_SIZE; i++) {
      bg.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, size);
      bg.lineBetween(0, i * TILE_SIZE, size, i * TILE_SIZE);
    }
    bg.setDepth(0);

    const frame = this.add.graphics();
    frame.lineStyle(7, 0x4dabf7, 0.08);
    frame.strokeRoundedRect(3, 3, size - 6, size - 6, 12);
    frame.lineStyle(2, 0x4dabf7, 0.45);
    frame.strokeRoundedRect(3, 3, size - 6, size - 6, 12);
    frame.setDepth(5);
  }

  private createTile(r: number, c: number, cell: CellModel): Tile {
    if (this.webgl && cell.kind === 'lightning') {
      return this.createLightningTile(r, c, cell);
    }
    const g = this.add.graphics();
    switch (cell.kind) {
      case 'ball':
        drawCrystal(g, paletteColor(cell.color));
        break;
      case 'bomb':
        drawBomb(g, paletteColor(cell.color));
        break;
      case 'lightning':
        drawLightning(g, paletteColor(cell.color), cell.orientation);
        break;
      case 'rainbow':
        drawRainbow(g);
        break;
    }
    g.setPosition(c * TILE_SIZE, r * TILE_SIZE);
    g.setDepth(1);
    g.setInteractive({
      hitArea: new Phaser.Geom.Circle(TILE_SIZE / 2, TILE_SIZE / 2, BALL_RADIUS + 4),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      cursor: 'pointer',
    });
    const tile = g as unknown as Tile;
    tile.r = r;
    tile.c = c;
    g.on('pointerdown', () => this.onTileClick(tile));
    return tile;
  }

  /**
   * Молния при WebGL: кристалл и ломаная рисуются собственным фрагментным
   * шейдером (`LIGHTNING_TILE_FRAG`) — линия мерцает и слегка колеблется.
   * Начало координат смещается в верхний левый угол, чтобы плитка двигалась
   * как обычная Graphics; гашение при очистке идёт через uniform uAlpha.
   */
  private createLightningTile(r: number, c: number, cell: LightningModel): Tile {
    const born = this.time.now;
    const shader = this.add.shader(
      {
        name: 'LightningTile',
        shaderName: nextShaderName('LightningTile'),
        fragmentSource: LIGHTNING_TILE_FRAG,
        initialUniforms: {
          uColor: hexToUnitRgb(paletteColor(cell.color)),
          uOrientation: cell.orientation === 'row' ? 0 : 1,
          uAlpha: 1,
          uSeed: Math.random() * 10,
        },
        setupUniforms: (setUniform: (name: string, value: number) => void) =>
          setUniform('uTime', (this.time.now - born) / 1000),
      },
      0,
      0,
      TILE_SIZE,
      TILE_SIZE,
    );
    shader.setOrigin(0, 0);
    shader.setPosition(c * TILE_SIZE, r * TILE_SIZE);
    shader.setDepth(1);
    shader.setInteractive({
      hitArea: new Phaser.Geom.Circle(TILE_SIZE / 2, TILE_SIZE / 2, BALL_RADIUS + 4),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      cursor: 'pointer',
    });
    const tile = shader as unknown as Tile;
    tile.r = r;
    tile.c = c;
    tile.on('pointerdown', () => this.onTileClick(tile));
    return tile;
  }

  private animate(items: TweenItem[], duration = FALL_DURATION): Promise<void> {
    if (items.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let remaining = items.length;
      items.forEach((it) => {
        const obj = it.obj;
        // У Shader нельзя менять alpha напрямую — гашение идёт через uniform.
        if (it.alpha !== undefined && obj instanceof Phaser.GameObjects.Shader) {
          const fade = { v: 1 };
          this.tweens.add({
            targets: fade,
            v: 0,
            duration,
            ease: 'Quad.easeOut',
            onUpdate: () => obj.setUniform('uAlpha', fade.v),
            onComplete: () => {
              remaining -= 1;
              if (remaining === 0) resolve();
            },
          });
          return;
        }
        const props: Record<string, number> = {};
        if (it.x !== undefined) props.x = it.x;
        if (it.y !== undefined) props.y = it.y;
        if (it.alpha !== undefined) props.alpha = it.alpha;
        this.tweens.add({
          targets: it.obj,
          ...props,
          duration,
          ease: 'Quad.easeOut',
          onComplete: () => {
            remaining -= 1;
            if (remaining === 0) resolve();
          },
        });
      });
    });
  }

  private hasMatches(): boolean {
    return findRuns(this.grid).length > 0;
  }

  /**
   * Проигрывает эффект молнии по каждой активации: вспышка по ячейкам
   * линии и ломаная-молния вдоль неё — клетки гаснут под разрядом.
   */
  private playLightnings(activations: readonly LightningActivation[]): Promise<void> {
    if (activations.length === 0) return Promise.resolve();
    const size = GRID_SIZE * TILE_SIZE;
    const tasks = activations.map(
      (act) =>
        new Promise<void>((resolve) => {
          if (
            act.pos.r < 0 ||
            act.pos.r >= GRID_SIZE ||
            act.pos.c < 0 ||
            act.pos.c >= GRID_SIZE
          ) {
            resolve();
            return;
          }
          if (this.webgl) {
            // Разряд шейдером: изгиб ломаной, мерцание и свечение целиком
            // живут в GLSL и управляются uTime — объект лишь создаётся
            // и удаляется по таймеру, без твинов.
            const born = this.time.now;
            const uLine =
              ((act.orientation === 'row' ? act.pos.r : act.pos.c) * TILE_SIZE + TILE_SIZE / 2) /
              size;
            const bolt = this.add
              .shader(
                {
                  name: 'LightningStrike',
                  shaderName: nextShaderName('LightningStrike'),
                  fragmentSource: LIGHTNING_STRIKE_FRAG,
                  initialUniforms: {
                    uOrientation: act.orientation === 'row' ? 0 : 1,
                    uLine,
                    uSeed: Math.random() * 100,
                  },
                  setupUniforms: (setUniform: (name: string, value: number) => void) =>
                    setUniform('uTime', (this.time.now - born) / 1000),
                },
                size / 2,
                size / 2,
                size,
                size,
              )
              .setDepth(4);
            this.time.delayedCall(STRIKE_DURATION_MS, () => {
              bolt.destroy();
              resolve();
            });
            return;
          }
          const isRow = act.orientation === 'row';
          const base = (isRow ? act.pos.r : act.pos.c) * TILE_SIZE + TILE_SIZE / 2;

          // Быстрая вспышка по ячейкам линии.
          const flash = this.add.graphics().setDepth(4);
          flash.fillStyle(0xbfe6ff, 0.5);
          if (isRow) flash.fillRect(0, act.pos.r * TILE_SIZE, size, TILE_SIZE);
          else flash.fillRect(act.pos.c * TILE_SIZE, 0, TILE_SIZE, size);

          // Ломаная-молния вдоль линии: свечение, полутон и белое ядро.
          const points: BoltPoint[] = [];
          const steps = 8;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const jitter = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * 22;
            points.push(
              isRow ? { x: t * size, y: base + jitter } : { x: base + jitter, y: t * size },
            );
          }
          const bolt = this.add.graphics().setDepth(4);
          strokeBolt(bolt, points, { glow: 18, mid: 10, core: 4 });

          flash.setAlpha(0);
          bolt.setAlpha(0);
          this.tweens.add({
            targets: [flash, bolt],
            alpha: 1,
            duration: 50,
            onComplete: () => {
              this.tweens.add({
                targets: [flash, bolt],
                alpha: 0,
                delay: 70,
                duration: 260,
                onComplete: () => {
                  flash.destroy();
                  bolt.destroy();
                  resolve();
                },
              });
            },
          });
        }),
    );
    return Promise.all(tasks).then(() => undefined);
  }

  private cellsOfColor(color: number): Set<string> {
    const keys = new Set<string>();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = this.grid[r][c];
        if (cell && cellColor(cell) === color) keys.add(`${r},${c}`);
      }
    }
    return keys;
  }

  private allCellKeys(): Set<string> {
    const keys = new Set<string>();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c]) keys.add(`${r},${c}`);
      }
    }
    return keys;
  }

  private async clearCells(keys: ReadonlySet<string>): Promise<void> {
    const doomed: Tile[] = [];
    keys.forEach((key) => {
      const pos = parseKey(key);
      this.grid[pos.r][pos.c] = null;
      const tile = this.tiles[pos.r][pos.c];
      if (tile) {
        this.tiles[pos.r][pos.c] = null as unknown as Tile;
        doomed.push(tile);
      }
    });
    if (doomed.length === 0) return;
    await this.animate(doomed.map((t) => ({ obj: t, alpha: 0 })));
    doomed.forEach((t) => t.destroy());
  }

  private spawnCreations(creations: ReadonlyMap<string, CellModel>): void {
    creations.forEach((model, key) => {
      const pos = parseKey(key);
      const oldTile = this.tiles[pos.r][pos.c];
      if (oldTile) oldTile.destroy();
      this.grid[pos.r][pos.c] = model;
      this.tiles[pos.r][pos.c] = this.createTile(pos.r, pos.c, model);
    });
  }

  /**
   * Разбирает совпадения, пока они остаются на поле: очищает цепочки
   * с активацией спецэлементов, создаёт новые особые элементы и
   * подтягивает гравитацию. Возвращает число очищенных клеток.
   */
  private async resolve(preferred: readonly Pos[] = []): Promise<number> {
    let total = 0;
    let preferredNow = preferred;
    while (true) {
      const runs = findRuns(this.grid);
      if (runs.length === 0) break;

      const creations = planSpecials(this.grid, runs, preferredNow);
      preferredNow = [];

      const anchors = new Set(creations.keys());
      const base = new Set<string>();
      runs.forEach((run) => run.cells.forEach((cell) => base.add(keyOf(cell))));
      anchors.forEach((key) => base.delete(key));

      const lightningFx: LightningActivation[] = [];
      const clearSet = expandClears(this.grid, base, anchors, EMPTY_KEYS, lightningFx);
      const fxTask = this.playLightnings(lightningFx);
      await this.clearCells(clearSet);
      await fxTask;
      this.spawnCreations(creations);
      await this.applyGravity();
      total += clearSet.size;
    }
    return total;
  }

  private async applyGravity(): Promise<void> {
    const moves: TweenItem[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      let write = GRID_SIZE - 1;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        const cell = this.grid[r][c];
        if (cell) {
          if (r !== write) {
            this.grid[write][c] = cell;
            this.grid[r][c] = null;
            const tile = this.tiles[r][c];
            this.tiles[write][c] = tile;
            this.tiles[r][c] = null as unknown as Tile;
            tile.r = write;
            moves.push({ obj: tile, x: c * TILE_SIZE, y: write * TILE_SIZE });
          }
          write--;
        }
      }
      let spawn = 1;
      for (let r = write; r >= 0; r--) {
        const cell = new BallModel(this.randomColorIndex());
        this.grid[r][c] = cell;
        const tile = this.createTile(r, c, cell);
        tile.setPosition(c * TILE_SIZE, -TILE_SIZE * spawn);
        spawn++;
        this.tiles[r][c] = tile;
        moves.push({ obj: tile, x: c * TILE_SIZE, y: r * TILE_SIZE });
      }
    }
    await this.animate(moves);
  }

  private swapLogical(a: Tile, b: Tile): void {
    const tmp = this.grid[a.r][a.c];
    this.grid[a.r][a.c] = this.grid[b.r][b.c];
    this.grid[b.r][b.c] = tmp;
    this.tiles[a.r][a.c] = b;
    this.tiles[b.r][b.c] = a;
    const { r, c } = a;
    a.r = b.r;
    a.c = b.c;
    b.r = r;
    b.c = c;
  }

  /**
   * Комбо, срабатывающие без совпадения: соединение радужного элемента
   * с другим элементом, объединение двух бомб, скрещивание бомбы
   * с молнией и скрещивание двух молний. Возвращает число очищенных
   * клеток или `null`, если обычного обмена без комбо.
   */
  private async tryCombo(a: Tile, b: Tile): Promise<number | null> {
    const cellA = this.grid[a.r][a.c];
    const cellB = this.grid[b.r][b.c];
    if (!cellA || !cellB) return null;

    let base: Set<string> | null = null;
    let consumed: ReadonlySet<string> = EMPTY_KEYS;
    const lightningFx: LightningActivation[] = [];

    if (cellA.kind === 'rainbow' || cellB.kind === 'rainbow') {
      const fromA = cellA.kind === 'rainbow';
      const rainbowPos = fromA ? { r: a.r, c: a.c } : { r: b.r, c: b.c };
      const other = fromA ? cellB : cellA;
      const otherPos = fromA ? { r: b.r, c: b.c } : { r: a.r, c: a.c };
      if (other.kind === 'rainbow') {
        // Две радужные вместе очищают всё поле.
        base = this.allCellKeys();
      } else if (other.kind === 'ball') {
        // Радужный списывает всё вокруг цвета, с которым соединяется.
        base = this.cellsOfColor(other.color);
        base.add(keyOf(rainbowPos));
      } else {
        // Соединение со спецэлементом активирует его, радужный поглощается.
        base = new Set([keyOf(rainbowPos), keyOf(otherPos)]);
      }
    } else if (cellA.kind === 'bomb' && cellB.kind === 'bomb') {
      // Две бомбы вместе — общий взрыв от середины между ними.
      base = blastKeys(
        (a.r + b.r) / 2,
        (a.c + b.c) / 2,
        BombModel.COMBINED_BLAST_RADIUS,
      );
    } else if (cellA.kind === 'lightning' && cellB.kind === 'lightning') {
      // Две молнии — каждая списывает свою линию: ряд и колонка
      // пересекаются в точке скрещения.
      const keys = new Set<string>();
      addLineKeys(keys, { r: a.r, c: a.c }, cellA.orientation);
      addLineKeys(keys, { r: b.r, c: b.c }, cellB.orientation);
      base = keys;
    } else if (
      (cellA.kind === 'bomb' && cellB.kind === 'lightning') ||
      (cellA.kind === 'lightning' && cellB.kind === 'bomb')
    ) {
      // Бомба + молния — ряд или колонка шириной 3 клетки по линии молнии.
      const lightning =
        cellA.kind === 'lightning' ? cellA : cellB.kind === 'lightning' ? cellB : null;
      const lightningPos = cellA.kind === 'lightning' ? { r: a.r, c: a.c } : { r: b.r, c: b.c };
      if (lightning) {
        base = bandKeys(lightningPos, lightning.orientation);
        // Участники гасятся без собственной активации — результат комбо ровно
        // лента, но по каждой её линии проходит эффект молнии.
        consumed = new Set([keyOf({ r: a.r, c: a.c }), keyOf({ r: b.r, c: b.c })]);
        for (let offset = -1; offset <= 1; offset++) {
          const pos =
            lightning.orientation === 'row'
              ? { r: lightningPos.r + offset, c: lightningPos.c }
              : { r: lightningPos.r, c: lightningPos.c + offset };
          lightningFx.push({ pos, orientation: lightning.orientation });
        }
      }
    }

    if (!base) return null;

    // Обе ячейки обмена должны очиститься в любом случае.
    base.add(keyOf({ r: a.r, c: a.c }));
    base.add(keyOf({ r: b.r, c: b.c }));

    const clearSet = expandClears(this.grid, base, new Set<string>(), consumed, lightningFx);
    const fxTask = this.playLightnings(lightningFx);
    await this.clearCells(clearSet);
    await fxTask;
    await this.applyGravity();
    const cascaded = await this.resolve();
    return clearSet.size + cascaded;
  }

  private async trySwap(a: Tile, b: Tile): Promise<void> {
    this.animating = true;
    this.swapLogical(a, b);
    await this.animate([
      { obj: a, x: a.c * TILE_SIZE, y: a.r * TILE_SIZE },
      { obj: b, x: b.c * TILE_SIZE, y: b.r * TILE_SIZE },
    ]);

    const comboCleared = await this.tryCombo(a, b);
    if (comboCleared !== null) {
      this.addScore(comboCleared);
      this.animating = false;
      return;
    }

    if (!this.hasMatches()) {
      this.swapLogical(a, b);
      await this.animate([
        { obj: a, x: a.c * TILE_SIZE, y: a.r * TILE_SIZE },
        { obj: b, x: b.c * TILE_SIZE, y: b.r * TILE_SIZE },
      ]);
      message.info('Нет совпадений', 0.8);
      this.animating = false;
      return;
    }

    const cleared = await this.resolve([
      { r: a.r, c: a.c },
      { r: b.r, c: b.c },
    ]);
    this.addScore(cleared);
    this.animating = false;
  }

  private addScore(cells: number): void {
    if (cells <= 0) return;
    this.score += cells * 10;
    this.onScoreChange(this.score);
    message.success(`+${cells * 10} очков!`, 0.8);
  }

  private onTileClick(tile: Tile): void {
    if (this.animating) return;
    const selected = this.selected;
    if (selected === tile) {
      this.clearSelection();
      return;
    }
    if (!selected) {
      this.selectTile(tile);
      return;
    }
    const adjacent = Math.abs(selected.r - tile.r) + Math.abs(selected.c - tile.c) === 1;
    if (!adjacent) {
      this.clearSelection();
      this.selectTile(tile);
      return;
    }
    this.clearSelection();
    void this.trySwap(selected, tile);
  }

  private selectTile(tile: Tile): void {
    this.selected = tile;
    const ring = this.add.graphics();
    ring.lineStyle(2, 0xffe066, 0.95);
    ring.strokeCircle(TILE_SIZE / 2, TILE_SIZE / 2, BALL_RADIUS + 3);
    ring.setPosition(tile.x, tile.y);
    ring.setDepth(3);
    this.tweens.add({
      targets: ring,
      alpha: 0.35,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.selectionRing = ring;
  }

  private clearSelection(): void {
    this.selected = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
  }
}
