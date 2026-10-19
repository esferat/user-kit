'use client';

import { Button, Typography } from 'antd';

import { NextBalls } from './NextBalls';
import styles from '../LinesGame.module.css';

interface TopBarProps {
  score: number;
  /** Шары следующего хода: индексы цветов палитры. */
  nextBalls: number[];
  hintOn: boolean;
  onHintToggle: () => void;
  onReset: () => void;
  onSettings: () => void;
  onHelp: () => void;
}

/** Верхний блок: заголовок, текущий счёт и кнопки управления. */
export function TopBar({ score, nextBalls, hintOn, onHintToggle, onReset, onSettings, onHelp }: TopBarProps) {
  return (
    <div className={styles.topRow}>
      <div className={styles.topLeft}>
        <Typography.Title level={2} className={styles.title}>
          Цветные линии
        </Typography.Title>
        <div className={styles.scorePill}>
          <span className={styles.ballIcon} aria-hidden />
          <span className={styles.scoreLabel}>Счёт</span>
          <strong className={styles.scoreValue}>{score}</strong>
        </div>
        <NextBalls balls={nextBalls} />
      </div>
      <div className={styles.controls}>
        <Button
          aria-label="Подсказка"
          aria-pressed={hintOn}
          title="Подсказка"
          onClick={onHintToggle}
          className={hintOn ? `${styles.iconButton} ${styles.hintActive}` : styles.iconButton}
        >
          💡
        </Button>
        <Button
          aria-label="Сброс игры"
          title="Сброс"
          onClick={onReset}
          className={`${styles.iconButton} ${styles.resetIcon}`}
        >
          ↻
        </Button>
        <Button
          aria-label="Настройки"
          title="Настройки"
          onClick={onSettings}
          className={`${styles.iconButton} ${styles.primaryIcon}`}
        >
          ⚙
        </Button>
        <Button aria-label="Правила игры" title="Правила игры" onClick={onHelp} className={styles.iconButton}>
          ?
        </Button>
      </div>
    </div>
  );
}
