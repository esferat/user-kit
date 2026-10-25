'use client';

import { Result } from 'antd';
import dynamic from 'next/dynamic';

/** Игра загружается на клиенте, чтобы Phaser.js не требовал SSR. */
const Match3Game = dynamic(() => import('@/features/match3'), {
  ssr: false,
  loading: () => <Result status="info" title="Загрузка игры..." />,
});

/** Страница «Три в ряд»: поле 10×10, уровни сложности, счёт сверху и таблица лидеров справа. */
export default function Match3Page() {
  return <Match3Game />;
}
