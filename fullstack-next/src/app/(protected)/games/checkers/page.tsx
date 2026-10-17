'use client';

import { Result } from 'antd';

/** Заготовка страницы игры: правила и поле появятся позже. */
export default function CheckersPage() {
  return (
    <Result
      status="info"
      title="Шашки"
      subTitle="Страница-заготовка. Игра ещё не реализована."
    />
  );
}
