'use client';

import { Result } from 'antd';

/** Заготовка страницы игры: правила и поле появятся позже. */
export default function ChessPage() {
  return (
    <Result
      status="info"
      title="Шахматы"
      subTitle="Страница-заготовка. Игра ещё не реализована."
    />
  );
}
