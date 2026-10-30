'use client';

import { Card, Typography } from 'antd';
import Link from 'next/link';

/** Каталог игр этого проекта: каждая игра живёт на своём маршруте. */
const GAMES = [
  {
    href: '/lines',
    title: 'Цветные линии',
    description:
      'Поле 9×9 на three.js: четыре сложности, предсказание следующих шаров, подсказка, звук и лучшие попытки в localStorage.',
  },
  {
    href: '/match3',
    title: 'Три в ряд',
    description:
      'Phaser 4: поле 10×10, уровни сложности, радужный, молния и бомба, каскады и таблица лидеров.',
  },
] as const;

/** Корень проекта — простой каталог: две ссылки на игры. */
export default function CatalogPage() {
  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <Typography.Title level={2} style={{ textAlign: 'center' }}>
        Игры User Kit
      </Typography.Title>
      <div style={{ display: 'grid', gap: 16, marginTop: 32 }}>
        {GAMES.map((game) => (
          <Link key={game.href} href={game.href}>
            <Card title={game.title} hoverable>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {game.description}
              </Typography.Paragraph>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
