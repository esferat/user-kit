import type { LightningOrientation } from '../model';

import { BALL_RADIUS, TILE_SIZE } from './constants';

function mixColor(color: number, target: number, t: number): number {
  const r = Math.round(((color >> 16) & 0xff) + (((target >> 16) & 0xff) - ((color >> 16) & 0xff)) * t);
  const g = Math.round(((color >> 8) & 0xff) + (((target >> 8) & 0xff) - ((color >> 8) & 0xff)) * t);
  const b = Math.round((color & 0xff) + ((target & 0xff) - (color & 0xff)) * t);
  return (r << 16) | (g << 8) | b;
}

const lighten = (color: number, t: number): number => mixColor(color, 0xffffff, t);
const darken = (color: number, t: number): number => mixColor(color, 0x000000, t);

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

/** Бомба: тёмный корпус, раскалённое красное ядро, ободок цвета совпадения. */
export function drawBomb(g: Phaser.GameObjects.Graphics, color: number): void {
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

/** Радужный элемент: тёмное основание, цветные кольца и жемчужное ядро. */
export function drawRainbow(g: Phaser.GameObjects.Graphics): void {
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
