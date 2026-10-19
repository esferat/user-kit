import type { CSSProperties } from 'react';

export const PANEL_STYLE: CSSProperties = {
  background: 'linear-gradient(180deg, #1c2230, #12151c)',
  border: '1px solid #33405a',
  borderRadius: 14,
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
};

/** Фон страницы повторяет фон игровой доски: градиент, шахматка и мягкая сетка. */
export const PAGE_STYLE: CSSProperties = {
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
  justifyContent: 'center'
};

export const PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  background: 'linear-gradient(180deg, #232a38, #171c26)',
  border: '1px solid #3b4657',
  borderRadius: 999,
  padding: '6px 18px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};

export const BALL_ICON_STYLE: CSSProperties = {
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

export const MOCK_LEADERS: LeaderboardEntry[] = [
  { name: 'Игрок 1', score: 1250 },
  { name: 'Игрок 2', score: 980 },
  { name: 'Игрок 3', score: 640 },
];

export const RANK_BADGES = [
  'radial-gradient(circle at 35% 30%, #ffe8a3, #f0b429 55%, #a8741a)',
  'radial-gradient(circle at 35% 30%, #f3f6fa, #b8c2cf 55%, #7c8797)',
  'radial-gradient(circle at 35% 30%, #ffd9b3, #d2894e 55%, #8f5424)',
];
