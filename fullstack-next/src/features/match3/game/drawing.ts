import type { LightningOrientation } from '../model';

import { BALL_RADIUS, TILE_SIZE } from './constants';

function mixColor(color: number, target: number, t: number): number {
  const r = Math.round(((color >> 16) & 0xff) + (((target >> 16) & 0xff) - ((color >> 16) & 0xff)) * t);
  const g = Math.round(((color >> 8) & 0xff) + (((target >> 8) & 0xff) - ((color >> 8) & 0xff)) * t);
  const b = Math.round((color & 0xff) + ((target & 0xff) - (color & 0xff)) * t);
  return (r << 16) | (g << 8) | b;
}

export const lighten = (color: number, t: number): number => mixColor(color, 0xffffff, t);
export const darken = (color: number, t: number): number => mixColor(color, 0x000000, t);

/** Обычный «кристалл»: свечение, объёмное тело, блики и ободок. */
export function drawCrystal(g: Phaser.GameObjects.Graphics, color: number): void {
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

/**
 * Бомба: тёмный корпус, раскалённое красное ядро, ободок цвета совпадения.
 * `phase` (в секундах) поджигает её: свечение и ядро дышат неровно,
 * над ядром играют огненные языки, от него поднимаются искры-угольки.
 */
export function drawBomb(g: Phaser.GameObjects.Graphics, color: number, phase = 0): void {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  // Неровное мерцание огня: две несоизмеримые частоты.
  const flick = 0.5 * Math.sin(phase * Math.PI * 22) + 0.5 * Math.sin(phase * Math.PI * 9.7 + 1.3);
  g.fillStyle(color, 0.1 + 0.03 * flick);
  g.fillCircle(cx, cy, BALL_RADIUS + 6);
  g.fillStyle(0x2e3440, 1);
  g.fillCircle(cx, cy, BALL_RADIUS);
  g.fillStyle(0x14171f, 0.5);
  g.fillCircle(cx + 4, cy + 5, BALL_RADIUS * 0.7);
  // Раскалённое свечение под кожей.
  g.fillStyle(0xff4d4d, 0.2 + 0.08 * flick);
  g.fillCircle(cx, cy, BALL_RADIUS * (0.62 + 0.04 * flick));
  // Огненные языки над ядром.
  const tongue = 5 + 3 * Math.sin(phase * Math.PI * 14);
  g.fillStyle(0xff4d4d, 0.3);
  g.fillCircle(cx, cy - 6, BALL_RADIUS * 0.48 + tongue * 0.6);
  g.fillStyle(0xff922b, 0.45 + 0.2 * Math.sin(phase * Math.PI * 18 + 0.7));
  g.fillCircle(cx + 2, cy - 9, BALL_RADIUS * 0.3 + tongue * 0.4);
  g.fillStyle(0xffe066, 0.65);
  g.fillCircle(cx, cy - 11, BALL_RADIUS * 0.15 + tongue * 0.25);
  // Ядро и блик.
  g.fillStyle(0xff6b6b, 0.95);
  g.fillCircle(cx, cy, BALL_RADIUS * (0.34 + 0.03 * flick));
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - BALL_RADIUS * 0.3, cy - BALL_RADIUS * 0.34, BALL_RADIUS * 0.1);
  // Искры поднимаются от ядра и гаснут.
  for (let i = 0; i < 3; i++) {
    const life = (phase * (0.5 + i * 0.17) + i * 0.41) % 1;
    const bright = (1 - life) * (0.5 + 0.5 * Math.sin(phase * Math.PI * 44 + i * 5));
    if (bright <= 0.02) continue;
    const ex = cx + Math.sin((life * 8 + i * 2.3) * 2) * (4 + life * 8);
    const ey = cy + 8 - life * 38;
    g.fillStyle(mixColor(0xff730a, 0xffe066, life), bright);
    g.fillCircle(ex, ey, 2 - life);
  }
  g.lineStyle(1.5, lighten(color, 0.2), 0.8);
  g.strokeCircle(cx, cy, BALL_RADIUS - 0.5);
}

export type BoltPoint = { x: number; y: number };

/** Обводит ломаную-молнию в три прохода: голубое свечение, полутон, белое ядро. */
export function strokeBolt(
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
export function drawLightning(
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
export function hexToUnitRgb(color: number): [number, number, number] {
  return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255];
}

/**
 * Радужный элемент: тёмное основание, цветные кольца и жемчужное ядро.
 * `phase` (в единицах «циклов», обычно `time / 2000`) оживляет рисунок:
 * цвета колец плавно перетекают по палитре, кольца дышат волной от
 * центра к краю, ядро пульсирует, от него расходится волна энергии,
 * а блик обходит по кругу. При `phase = 0` (по умолчанию) рисунок
 * совпадает со статичной версией.
 */
export function drawRainbow(g: Phaser.GameObjects.Graphics, phase = 0): void {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  const beat = Math.sin(phase * Math.PI * 4);
  g.fillStyle(0xffffff, 0.1 + 0.03 * beat);
  g.fillCircle(cx, cy, BALL_RADIUS + 6);
  g.fillStyle(0x232833, 1);
  g.fillCircle(cx, cy, BALL_RADIUS);
  const ringColors = [0xff6b6b, 0xff922b, 0xffe066, 0x51cf66, 0x4dabf7, 0xcc5de8];
  ringColors.forEach((_, i) => {
    // Цвет кольца плавно перетекает к следующему цвету палитры.
    const k = i + phase;
    const from = ringColors[Math.floor(k) % ringColors.length];
    const to = ringColors[(Math.floor(k) + 1) % ringColors.length];
    const color = mixColor(from, to, k - Math.floor(k));
    // Кольца дышат волной, идущей от центра к краю.
    const radius = BALL_RADIUS - 2 - i * 5 + 1.2 * Math.sin(phase * Math.PI * 4 - i * 0.7);
    g.lineStyle(3.2 + 0.6 * Math.sin(phase * Math.PI * 6 + i), color, 0.95);
    g.strokeCircle(cx, cy, radius);
  });
  // Волна энергии расходится от ядра к краю.
  const wave = (phase * 1.1) % 1;
  g.lineStyle(2, 0xffffff, 0.3 * (1 - wave));
  g.strokeCircle(cx, cy, wave * (BALL_RADIUS - 2));
  // Блик обходит ядро по кругу.
  const glintAngle = phase * Math.PI * 2 * 0.55;
  g.fillStyle(0xffffff, 0.35 + 0.35 * Math.sin(phase * Math.PI * 10));
  g.fillCircle(cx + Math.cos(glintAngle) * BALL_RADIUS * 0.52, cy + Math.sin(glintAngle) * BALL_RADIUS * 0.52, 2);
  // Жемчужное ядро пульсирует.
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx, cy, BALL_RADIUS * (0.16 + 0.035 * beat));
  g.lineStyle(1.5, 0xffffff, 0.4 + 0.15 * beat);
  g.strokeCircle(cx, cy, BALL_RADIUS - 0.5);
}
