'use client';

import { Result } from 'antd';
import dynamic from 'next/dynamic';

/** Игра загружается на клиенте, чтобы Phaser.js не требовал SSR. */
const LinesGame = dynamic(() => import('@/features/lines'), {
  ssr: false,
  loading: () => <Result status="info" title="Загрузка игры..." />,
});

/** Страница «Цветные линии»: счёт и настройки сверху, поле в центре, лучшие попытки справа. */
export default function LinesPage() {
  return <LinesGame />;
}
