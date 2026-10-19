'use client';

import { Button, Space, Typography } from 'antd';
import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';

import { GRID_SIZE, TILE_SIZE } from '../game/constants';
import { Match3Scene } from '../game/scene';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type DifficultyKey } from '../model';
import {
  BALL_ICON_STYLE,
  MOCK_LEADERS,
  PAGE_STYLE,
  PILL_STYLE,
  PANEL_STYLE,
  RANK_BADGES,
} from './styles';

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
      <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
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
        <Space orientation="vertical" size={6} style={{ display: 'flex', maxWidth: 825 }}>
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
        <Space orientation="vertical" size={6} style={{ display: 'flex' }}>
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
