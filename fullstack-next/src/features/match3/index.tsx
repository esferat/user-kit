'use client';

import { Button, Space, Typography, message } from 'antd';
import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';

import {
  BallModel,
  BombModel,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  LightningModel,
  RainbowModel,
  cellColor,
  type CellModel,
  type DifficultyKey,
  type LightningOrientation,
} from './model';

const GRID_SIZE = 10;
const TILE_SIZE = 80;
const BALL_RADIUS = TILE_SIZE / 2 - 8;
/** Шесть цветов: уровни сложности используют первые 4, 5 или 6 из них. */
const COLORS = [0x4dabf7, 0xff6b6b, 0x51cf66, 0xffe066, 0xcc5de8, 0xff922b];
const FALL_DURATION = 200;
const EMPTY_KEYS: ReadonlySet<string> = new Set();

const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #1c2230, #12151c)',
  border: '1px solid #33405a',
  borderRadius: 14,
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
};

/** Фон страницы повторяет фон игровой доски: градиент, шахматка и мягкая сетка. */
const PAGE_STYLE: React.CSSProperties = {
  // Отрицательные поля отменяют padding контента AppShell — игра занимает всю страницу.
  margin: '-2rem',
  minHeight: 'calc(100vh - 64px)',
  padding: '1.5rem',
  display: 'flex',
  gap: '1.5rem',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  backgroundImage: [
    'repeating-linear-gradient(to right, rgba(43, 52, 70, 0.5) 0 1px, transparent 1px 80px)',
    'repeating-linear-gradient(to bottom, rgba(43, 52, 70, 0.5) 0 1px, transparent 1px 80px)',
    'linear-gradient(45deg, rgba(255, 255, 255, 0.025) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.025) 75%)',
    'linear-gradient(45deg, rgba(255, 255, 255, 0.025) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.025) 75%)',
    'linear-gradient(180deg, #1a2130, #10141b)',
  ].join(', '),
  backgroundSize: 'auto, auto, 160px 160px, 160px 160px, 100% 100%',
  backgroundPosition: '0 0, 0 0, 0 0, 80px 80px, 0 0',
  backgroundRepeat: 'repeat, repeat, repeat, repeat, no-repeat',
};

const PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  background: 'linear-gradient(180deg, #232a38, #171c26)',
  border: '1px solid #3b4657',
  borderRadius: 999,
  padding: '6px 18px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};

const BALL_ICON_STYLE: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  flexShrink: 0,
  background:
    'radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.28) 18%, #4dabf7 42%, #1f5fae 100%)',
  boxShadow: '0 0 10px rgba(77, 171, 247, 0.7)',
};

interface LeaderboardEntry {
  name: string;
  score: number;
}

const MOCK_LEADERS: LeaderboardEntry[] = [
  { name: 'Игрок 1', score: 1250 },
  { name: 'Игрок 2', score: 980 },
  { name: 'Игрок 3', score: 640 },
];

const RANK_BADGES = [
  'radial-gradient(circle at 35% 30%, #ffe8a3, #f0b429 55%, #a8741a)',
  'radial-gradient(circle at 35% 30%, #f3f6fa, #b8c2cf 55%, #7c8797)',
  'radial-gradient(circle at 35% 30%, #ffd9b3, #d2894e 55%, #8f5424)',
];

interface Pos {
  r: number;
  c: number;
}

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

interface Run {
  dir: 'h' | 'v';
  color: number;
  cells: Pos[];
}

/** Сработавшая молния: позиция и линия, которую она очищает. */
interface LightningActivation {
  pos: Pos;
  orientation: LightningOrientation;
}

function keyOf(pos: Pos): string {
  return `${pos.r},${pos.c}`;
}

/** Индекс цвета в палитре → цвет Phaser. */
const paletteColor = (index: number): number => COLORS[index] ?? 0xffffff;

function parseKey(key: string): Pos {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

function mixColor(color: number, target: number, t: number): number {
  const r = Math.round(((color >> 16) & 0xff) + (((target >> 16) & 0xff) - ((color >> 16) & 0xff)) * t);
  const g = Math.round(((color >> 8) & 0xff) + (((target >> 8) & 0xff) - ((color >> 8) & 0xff)) * t);
  const b = Math.round((color & 0xff) + ((target & 0xff) - (color & 0xff)) * t);
  return (r << 16) | (g << 8) | b;
}

const lighten = (color: number, t: number): number => mixColor(color, 0xffffff, t);
const darken = (color: number, t: number): number => mixColor(color, 0x000000, t);

/** Обычный «кристалл»: свечение, объёмное тело, блики и ободок. */
function drawCrystal(g: Phaser.GameObjects.Graphics, color: number): void {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  g.fillStyle(color, 0.12);
  g.fillCircle(cx, cy, BALL_RADIUS + 6);
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy, BALL_RADIUS);
  g.fillStyle(darken(color, 0.55), 0.35);
  g.fillCircle(cx + BALL_RADIUS * 0.12, cy + BALL_RADIUS * 0.14, BALL_RADIUS * 0.85);
  g.fillStyle(lighten(color, 0.55), 0.45);
  g.fillCircle(cx - BALL_RADIUS * 0.28, cy - BALL_RADIUS * 0.3, BALL_RADIUS * 0.42);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - BALL_RADIUS * 0.38, cy - BALL_RADIUS * 0.42, BALL_RADIUS * 0.14);
  g.lineStyle(1.5, lighten(color, 0.25), 0.55);
  g.strokeCircle(cx, cy, BALL_RADIUS - 0.5);
}

/** Бомба: тёмный корпус, раскалённое красное ядро, ободок цвета совпадения. */
function drawBomb(g: Phaser.GameObjects.Graphics, color: number): void {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  g.fillStyle(color, 0.12);
  g.fillCircle(cx, cy, BALL_RADIUS + 6);
  g.fillStyle(0x2e3440, 1);
  g.fillCircle(cx, cy, BALL_RADIUS);
  g.fillStyle(0x14171f, 0.5);
  g.fillCircle(cx + 4, cy + 5, BALL_RADIUS * 0.7);
  g.fillStyle(0xff4d4d, 0.22);
  g.fillCircle(cx, cy, BALL_RADIUS * 0.62);
  g.fillStyle(0xff6b6b, 0.95);
  g.fillCircle(cx, cy, BALL_RADIUS * 0.34);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - BALL_RADIUS * 0.3, cy - BALL_RADIUS * 0.34, BALL_RADIUS * 0.1);
  g.lineStyle(1.5, lighten(color, 0.2), 0.8);
  g.strokeCircle(cx, cy, BALL_RADIUS - 0.5);
}

type BoltPoint = { x: number; y: number };

/** Обводит ломаную-молнию в три прохода: голубое свечение, полутон, белое ядро. */
function strokeBolt(
  g: Phaser.GameObjects.Graphics,
  points: readonly BoltPoint[],
  widths: { glow: number; mid: number; core: number } = { glow: 14, mid: 8, core: 3 },
): void {
  const pass = (color: number, width: number, alpha: number): void => {
    g.lineStyle(width, color, alpha);
    for (let i = 1; i < points.length; i++) {
      g.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
  };
  pass(0x4dabf7, widths.glow, 0.35);
  pass(0x99d9ff, widths.mid, 0.75);
  pass(0xffffff, widths.core, 1);
}

/** Молния: кристалл своего цвета и бело-голубая ломаная молния поверх. */
function drawLightning(
  g: Phaser.GameObjects.Graphics,
  color: number,
  orientation: LightningOrientation,
): void {
  drawCrystal(g, color);
  const points: BoltPoint[] =
    orientation === 'row'
      ? [
          { x: 15, y: 52 },
          { x: 35, y: 30 },
          { x: 43, y: 50 },
          { x: 65, y: 28 },
        ]
      : [
          { x: 28, y: 15 },
          { x: 50, y: 35 },
          { x: 30, y: 43 },
          { x: 52, y: 65 },
        ];
  strokeBolt(g, points);
}

/** HEX-цвет палитры → вектор RGB 0..1 для uniform'ов шейдера. */
function hexToUnitRgb(color: number): [number, number, number] {
  return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255];
}

/**
 * Счётчик имён шейдеров: имя попадает в имя шейдерной программы,
 * а каждому объекту нужна своя программа — uniform'ы у них разные.
 */
let shaderSeq = 0;

/** Длительность эффекта разряда (шейдер гаснет сам к 400 мс, объект удаляется позже). */
const STRIKE_DURATION_MS = 420;

/**
 * Фрагментный шейдер плитки-молнии. Кристалл своего цвета (раскладка
 * как у Graphics-версии `drawCrystal`), а поверх — живая молния, которая
 * проходит ровно по линии списания: горизонтально для строки, вертикально
 * для столбца. Форма ломаной пересчитывается тиками (~9 раз/с), яркость
 * мерцает, иногда проходит вспышка; по краям пульсируют пары стрелок-шевронов,
 * показывающих направление. Координаты — пиксели плитки, начало сверху слева.
 * Цвет выводится в предмножительном виде (блендинг ONE).
 */
const LIGHTNING_TILE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform vec3 uColor;
uniform float uOrientation;
uniform float uTime;
uniform float uAlpha;
uniform float uSeed;

float hash(float n) {
  return fract(sin(n * 91.7 + uSeed * 47.3) * 43758.5453123);
}

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

// Слой поверх: обычный альфа-овер поверх уже нарисованного. Слои корректно
// ложатся на непрозрачный кристалл — молния и стрелки видны поверх шарика.
void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

// Расстояние до отрезка.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float size = ${TILE_SIZE}.0;
  float radius = ${BALL_RADIUS}.0;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * size;
  vec2 center = vec2(size * 0.5);
  float mid = size * 0.5;
  float d = length(p - center);

  bool row = uOrientation < 0.5;

  vec3 col = vec3(0.0);
  float a = 0.0;

  // Кристалл: дышащий ореол, тело, тень, блик, искра и ободок.
  layer(
    col, a, uColor,
    (0.09 + 0.05 * sin(uTime * 3.0 + uSeed * 2.0))
      * (1.0 - smoothstep(radius + 5.0, radius + 6.0, d))
  );
  layer(col, a, uColor, 1.0 - smoothstep(radius - 1.0, radius, d));
  layer(
    col, a, uColor * 0.45,
    0.35 * (1.0 - smoothstep(radius * 0.85 - 0.8, radius * 0.85, length(p - (center + vec2(3.8, 4.5)))))
  );
  layer(
    col, a, uColor * 0.45 + 0.55,
    0.45 * (1.0 - smoothstep(radius * 0.42 - 0.8, radius * 0.42, length(p - (center - vec2(9.0, 9.6)))))
  );
  layer(
    col, a, vec3(1.0),
    0.9 * (1.0 - smoothstep(radius * 0.14 - 0.6, radius * 0.14, length(p - (center - vec2(12.2, 13.4)))))
  );
  layer(
    col, a, uColor * 0.75 + 0.25,
    0.55 * (1.0 - smoothstep(0.35, 0.75, abs(d - (radius - 0.5))))
  );

  // Молния строго по линии списания: ломаная из семи узлов идёт от края
  // до края плитки (узлы у краёв прижаты к оси — разряд захватывает всю
  // линию), размах сильнее в центре. Форма меняется тиками ~9 раз/с.
  float tick = floor(uTime * 9.0);
  float flick = 0.62 + 0.38 * hash(tick * 1.37);
  float surge = smoothstep(0.55, 0.9, vnoise(uTime * 2.6 + uSeed * 13.0));
  float energy = min(flick + surge * 0.7, 1.6);
  float boltDist = 1e5;
  vec2 prev = row ? vec2(0.0, mid) : vec2(mid, 0.0);
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    float amp = sin(t * 3.14159) * 24.0;
    float jitter = (vnoise(float(i) * 1.7 + tick * 3.7 + uSeed * 5.0) - 0.5) * amp;
    vec2 node = row ? vec2(t * size, mid + jitter) : vec2(mid + jitter, t * size);
    boltDist = min(boltDist, segDist(p, prev, node));
    prev = node;
  }
  layer(col, a, uColor * 0.35 + 0.65, (1.0 - smoothstep(4.0, 12.0, boltDist)) * 0.4 * energy);
  layer(col, a, vec3(0.62, 0.85, 1.0), (1.0 - smoothstep(1.8, 5.5, boltDist)) * 0.75 * energy);
  layer(col, a, vec3(1.0), (1.0 - smoothstep(0.5, 1.8, boltDist)) * energy);

  // Стрелки направления: по два шеврона с каждой стороны линии, они по
  // очереди вспыхивают и чуть едут наружу — читается, что спишется именно
  // этот ряд или столбец.
  vec3 arrowColor = vec3(0.72, 0.9, 1.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float pulse = 0.5 + 0.5 * sin((uTime * 2.2 - fi * 0.6) * 6.28318 + uSeed);
    pulse *= pulse;
    float off = 23.0 + fi * 11.0 + pulse * 3.0;
    for (int s = 0; s < 2; s++) {
      float sideS = float(s) * 2.0 - 1.0;
      vec2 tip = row ? vec2(mid + sideS * off, mid) : vec2(mid, mid + sideS * off);
      vec2 back = row ? vec2(-sideS * 8.0, 0.0) : vec2(0.0, -sideS * 8.0);
      vec2 spread = row ? vec2(0.0, 6.5) : vec2(6.5, 0.0);
      float arrowDist = min(
        segDist(p, tip, tip + back + spread),
        segDist(p, tip, tip + back - spread)
      );
      layer(col, a, arrowColor, (1.0 - smoothstep(0.6, 2.0, arrowDist)) * 0.85 * pulse);
      layer(col, a, uColor * 0.3 + 0.7, (1.0 - smoothstep(1.8, 5.5, arrowDist)) * 0.3 * pulse);
    }
  }

  gl_FragColor = vec4(col * uAlpha, a * uAlpha);
}
`;

/**
 * Фрагментный шейдер разряда молнии по линии: процедурная ломаная
 * вдоль строки или столбца с многооктавным изгибом, мерцанием новой
 * формы каждые ~45 мс, широким голубым свечением, полутоном, белым
 * ядром и вспышкой по ячейкам линии. Огибающая считается из uTime,
 * поэтому объект достаточно создать и удалить — твины не нужны.
 */
const LIGHTNING_STRIKE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform float uOrientation;
uniform float uLine;
uniform float uTime;
uniform float uSeed;

float hash(float n) {
  return fract(sin(n * 127.1 + uSeed * 91.7) * 43758.5453123);
}

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

void main() {
  float board = ${GRID_SIZE * TILE_SIZE}.0;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * board;
  bool isRow = uOrientation < 0.5;
  float axis = isRow ? p.x : p.y;
  float offset = (isRow ? p.y : p.x) - uLine * board;

  // Огибающая удара: быстрый всплеск, короткая пауза, затухание.
  float env = smoothstep(0.0, 0.05, uTime) * (1.0 - smoothstep(0.14, 0.40, uTime));
  // Мерцание: новая форма ломаной каждые ~45 мс.
  float tick = floor(uTime * 22.0);
  float flick = 0.72 + 0.28 * hash(tick * 1.37);

  // Изгиб: два октава шума, концы закреплены у краёв доски.
  float ends = smoothstep(0.0, 70.0, axis) * smoothstep(0.0, 70.0, board - axis);
  float jitter = ((vnoise(axis * 0.013 + tick * 7.31) - 0.5) * 46.0
    + (vnoise(axis * 0.052 + tick * 3.7) - 0.5) * 14.0) * ends;
  float d = abs(offset - jitter);

  vec3 col = vec3(0.0);
  float a = 0.0;
  // Вспышка по ячейкам линии: полоса шириной в клетку.
  layer(col, a, vec3(0.75, 0.90, 1.0), (1.0 - smoothstep(8.0, 38.0, abs(offset))) * 0.34 * env * flick);
  // Голубое свечение, полутон и белое ядро разряда.
  layer(col, a, vec3(0.30, 0.65, 1.0), exp(-d * d / 520.0) * 0.55 * env * flick);
  layer(col, a, vec3(0.62, 0.85, 1.0), exp(-d * d / 90.0) * 0.80 * env);
  layer(col, a, vec3(1.0), (1.0 - smoothstep(0.6, 2.6, d)) * env);

  gl_FragColor = vec4(col, a);
}
`;

/** Радужный элемент: тёмное основание, цветные кольца и жемчужное ядро. */
function drawRainbow(g: Phaser.GameObjects.Graphics): void {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(cx, cy, BALL_RADIUS + 6);
  g.fillStyle(0x232833, 1);
  g.fillCircle(cx, cy, BALL_RADIUS);
  const ringColors = [0xff6b6b, 0xff922b, 0xffe066, 0x51cf66, 0x4dabf7, 0xcc5de8];
  ringColors.forEach((ring, i) => {
    g.lineStyle(3.5, ring, 0.95);
    g.strokeCircle(cx, cy, BALL_RADIUS - 2 - i * 5);
  });
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx, cy, BALL_RADIUS * 0.16);
  g.lineStyle(1.5, 0xffffff, 0.5);
  g.strokeCircle(cx, cy, BALL_RADIUS - 0.5);
}

class Match3Scene extends Phaser.Scene {
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
    while (this.findRuns().length > 0) {
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
        shaderName: `LightningTile-${shaderSeq++}`,
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

  private colorAt(r: number, c: number): number | null {
    const cell = this.grid[r][c];
    return cell ? cellColor(cell) : null;
  }

  /** Все горизонтальные и вертикальные цепочки из трёх и более одинаковых цветов. */
  private findRuns(): Run[] {
    const runs: Run[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      let c = 0;
      while (c < GRID_SIZE) {
        const color = this.colorAt(r, c);
        let end = c + 1;
        if (color !== null) {
          while (end < GRID_SIZE && this.colorAt(r, end) === color) end++;
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
        const color = this.colorAt(r, c);
        let end = r + 1;
        if (color !== null) {
          while (end < GRID_SIZE && this.colorAt(end, c) === color) end++;
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

  private hasMatches(): boolean {
    return this.findRuns().length > 0;
  }

  /**
   * Планирует новые особые элементы по правилам:
   * 5+ в ряд — радужный элемент, ровно 4 в ряд — молния
   * (горизонтальный ряд даёт молнию строки, вертикальный — столбца),
   * 5 и больше не в ряд (пересечение горизонтали и вертикали) — бомба.
   */
  private planSpecials(runs: readonly Run[], preferred: readonly Pos[]): Map<string, CellModel> {
    const creations = new Map<string, CellModel>();
    const used = new Set<string>();

    const pickAnchor = (cells: readonly Pos[]): string | null => {
      // Якорем может стать только обычный шарик: спецэлемент не должен
      // затирать другой спецэлемент без активации.
      const keys = cells
        .filter((cell) => this.grid[cell.r][cell.c]?.kind === 'ball')
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
        const cell = this.grid[pos.r][pos.c];
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
   * Сработавшие молнии записываются в `lightningFx` для эффекта по линии.
   */
  private expandClears(
    base: Iterable<string>,
    protectedKeys: ReadonlySet<string>,
    consumed: ReadonlySet<string> = EMPTY_KEYS,
    lightningFx?: LightningActivation[],
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
      const cell = this.grid[pos.r][pos.c];
      if (!cell) continue;
      if (cell.kind === 'bomb') {
        const radius = cell.blastRadius;
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            if (Math.hypot(dr, dc) <= radius) add(pos.r + dr, pos.c + dc);
          }
        }
      } else if (cell.kind === 'lightning') {
        // Разряд молнии: линия очищается, эффект играется над затухающими клетками.
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
  private blastKeys(centerR: number, centerC: number, radius: number): Set<string> {
    const keys = new Set<string>();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (Math.hypot(r - centerR, c - centerC) <= radius) keys.add(`${r},${c}`);
      }
    }
    return keys;
  }

  /** Добавляет в набор клетки всей строки или столбца, проходящих через позицию. */
  private addLineKeys(target: Set<string>, pos: Pos, orientation: LightningOrientation): void {
    for (let i = 0; i < GRID_SIZE; i++) {
      if (orientation === 'row') target.add(`${pos.r},${i}`);
      else target.add(`${i},${pos.c}`);
    }
  }

  /**
   * Лента шириной 3 клетки вдоль линии молнии: для строки — три соседних
   * ряда, для столбца — три соседние колонки.
   */
  private bandKeys(pos: Pos, orientation: LightningOrientation): Set<string> {
    const keys = new Set<string>();
    for (let offset = -1; offset <= 1; offset++) {
      if (orientation === 'row') this.addLineKeys(keys, { r: pos.r + offset, c: pos.c }, 'row');
      else this.addLineKeys(keys, { r: pos.r, c: pos.c + offset }, 'col');
    }
    return keys;
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
                  shaderName: `LightningStrike-${shaderSeq++}`,
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
      const runs = this.findRuns();
      if (runs.length === 0) break;

      const creations = this.planSpecials(runs, preferredNow);
      preferredNow = [];

      const anchors = new Set(creations.keys());
      const base = new Set<string>();
      runs.forEach((run) => run.cells.forEach((cell) => base.add(keyOf(cell))));
      anchors.forEach((key) => base.delete(key));

      const lightningFx: LightningActivation[] = [];
      const clearSet = this.expandClears(base, anchors, EMPTY_KEYS, lightningFx);
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
      base = this.blastKeys(
        (a.r + b.r) / 2,
        (a.c + b.c) / 2,
        BombModel.COMBINED_BLAST_RADIUS,
      );
    } else if (cellA.kind === 'lightning' && cellB.kind === 'lightning') {
      // Две молнии — каждая списывает свою линию: ряд и колонка
      // пересекаются в точке скрещения.
      const keys = new Set<string>();
      this.addLineKeys(keys, { r: a.r, c: a.c }, cellA.orientation);
      this.addLineKeys(keys, { r: b.r, c: b.c }, cellB.orientation);
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
        base = this.bandKeys(lightningPos, lightning.orientation);
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

    const clearSet = this.expandClears(base, new Set<string>(), consumed, lightningFx);
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

export function Match3Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<Match3Scene | null>(null);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyKey>(DEFAULT_DIFFICULTY.key);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return;
    }
    const scene = new Match3Scene(setScore, DEFAULT_DIFFICULTY.colors);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: GRID_SIZE * TILE_SIZE,
      height: GRID_SIZE * TILE_SIZE,
      parent: containerRef.current,
      backgroundColor: '#10141b',
      scene: [scene],
    });
    gameRef.current = game;
    sceneRef.current = scene;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  const activeDifficulty =
    DIFFICULTIES.find((d) => d.key === difficulty) ?? DEFAULT_DIFFICULTY;

  const changeDifficulty = (key: DifficultyKey) => {
    const next = DIFFICULTIES.find((d) => d.key === key);
    if (!next) return;
    setDifficulty(key);
    sceneRef.current?.setDifficulty(next.colors);
  };

  const resetGame = () => {
    sceneRef.current?.resetGame();
  };

  return (
    <div style={PAGE_STYLE}>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <Space align="center" wrap size="large">
          <Typography.Title
            level={2}
            style={{
              margin: 0,
              fontWeight: 700,
              background: 'linear-gradient(90deg, #4dabf7, #51cf66)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Три в ряд
          </Typography.Title>
          <div style={PILL_STYLE}>
            {DIFFICULTIES.map((d) => {
              const active = d.key === activeDifficulty.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => changeDifficulty(d.key)}
                  title={`${d.colors} цветов на поле`}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '5px 14px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    background: active ? 'linear-gradient(180deg, #4dabf7, #2b7fd4)' : 'transparent',
                    color: active ? '#0b1524' : '#9fb0c8',
                    boxShadow: active ? '0 4px 14px rgba(77, 171, 247, 0.35)' : 'none',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <Typography.Text style={{ color: '#7c8ba1', fontSize: 13 }}>
            {activeDifficulty.colors} {activeDifficulty.colors === 4 ? 'цвета' : 'цветов'}
          </Typography.Text>
          <div style={PILL_STYLE}>
            <span style={BALL_ICON_STYLE} />
            <span style={{ color: '#9fb0c8' }}>Счёт</span>
            <strong
              style={{
                color: '#ffe066',
                fontSize: 22,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {score}
            </strong>
          </div>
          <Button
            onClick={resetGame}
            style={{
              background: 'linear-gradient(180deg, #4dabf7, #2b7fd4)',
              border: 'none',
              borderRadius: 999,
              color: '#0b1524',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(77, 171, 247, 0.35)',
            }}
          >
            Сбросить
          </Button>
        </Space>
        <Space direction="vertical" size={6} style={{ display: 'flex' }}>
          <div style={{ ...PANEL_STYLE, padding: 10, display: 'inline-block' }}>
            <div ref={containerRef} style={{ lineHeight: 0, borderRadius: 8, overflow: 'hidden' }} />
          </div>
          <Typography.Text style={{ color: '#7c8ba1', fontSize: 13 }}>
            4 в ряд — молния · 5 в ряд — радужный элемент · 5 не в ряд — бомба; комбо: бомба +
            молния — лента шириной 3, две молнии — ряд и колонка, две бомбы — мощный взрыв
          </Typography.Text>
        </Space>
      </Space>
      <div style={{ ...PANEL_STYLE, padding: '1rem', width: 260 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingBottom: 10,
            marginBottom: 10,
            borderBottom: '1px solid #2a3345',
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🏆</span>
          <span style={{ color: '#e9edf5', fontWeight: 600 }}>Таблица лидеров</span>
        </div>
        <Space direction="vertical" size={6} style={{ display: 'flex' }}>
          {MOCK_LEADERS.map((entry, idx) => (
            <div
              key={`${entry.name}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 8,
                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: RANK_BADGES[idx] ?? 'rgba(255, 255, 255, 0.1)',
                  color: '#10131a',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {idx + 1}
              </span>
              <span style={{ color: '#d7dde8', flex: 1 }}>{entry.name}</span>
              <strong style={{ color: '#ffe066', fontVariantNumeric: 'tabular-nums' }}>
                {entry.score}
              </strong>
            </div>
          ))}
        </Space>
      </div>
    </div>
  );
}

export default Match3Game;
