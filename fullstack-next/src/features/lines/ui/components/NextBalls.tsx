'use client';

import { type CSSProperties } from 'react';

import { BALL_PALETTE } from '../../game/balls';
import styles from '../LinesGame.module.css';

interface NextBallsProps {
  /** Шары следующего хода: индексы цветов палитры. */
  balls: number[];
}

/** Панель между счётом и кнопками: показывает шары, выпадающие в следующем ходу. */
export function NextBalls({ balls }: NextBallsProps) {
  return (
    <div className={styles.nextPanel} aria-label="Выпадут в следующем ходу" title="Выпадут в следующем ходу">
      <span className={styles.nextLabel}>Дальше</span>
      <div className={styles.nextBalls}>
        {balls.map((colorIdx, idx) => {
          const color = BALL_PALETTE[colorIdx % BALL_PALETTE.length];
          const ballVars = {
            '--ball-main': color.main,
            '--ball-light': color.light,
            '--ball-dark': color.dark,
          } as CSSProperties;
          return <span key={idx} className={styles.nextBall} style={ballVars} aria-hidden />;
        })}
      </div>
    </div>
  );
}
