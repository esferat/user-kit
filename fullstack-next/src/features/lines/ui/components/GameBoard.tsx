'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { LinesBoard } from '../../game/board';
import { GRID_SIZE } from '../../game/constants';
import type { LinesState } from '../../game/engine';
import styles from '../LinesGame.module.css';

interface GameBoardProps {
  /** Текущее состояние партии: шарики, предпросмотр, выделение. */
  state: LinesState;
  selected: number | null;
  /** Маршрут подсказки — белые следы; гаснет при выделении шара. */
  hintPath: number[] | null;
  /** Клик по клетке: доска отдаёт номер клетки и свою ссылку — на ней крутятся анимации. */
  onCellClick: (cell: number, board: LinesBoard) => void;
}

/** Центральная часть: интерактивное поле на three.js (плитки, шарики, обрамление из растений). */
export function GameBoard({ state, selected, hintPath, onCellClick }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<LinesBoard | null>(null);
  const clickRef = useRef(onCellClick);
  const [boardFailed, setBoardFailed] = useState(false);

  // Ссылка на актуальный обработчик: доска создаётся один раз.
  useLayoutEffect(() => {
    clickRef.current = onCellClick;
  });

  // Трёхмерное поле создаётся один раз на клиенте.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || boardRef.current) return;
    try {
      boardRef.current = new LinesBoard(container, (cell) => {
        const board = boardRef.current;
        if (board) clickRef.current(cell, board);
      });
    } catch {
      // Показ запасной сетки откладываем: правило React запрещает setState
      // синхронно в теле эффекта.
      requestAnimationFrame(() => setBoardFailed(true));
    }
    return () => {
      boardRef.current?.dispose();
      boardRef.current = null;
    };
  }, []);

  // Синхронизация сцены с моделью — layout-effect, чтобы не мигало до отрисовки.
  useLayoutEffect(() => {
    boardRef.current?.sync(state.board, state.nextCells, state.nextColors, selected, hintPath);
  }, [state, selected, hintPath]);

  return (
    <section className={`${styles.panel} ${styles.boardPanel}`}>
      {boardFailed ? (
        // Запасной вариант, если WebGL недоступен.
        <div className={styles.fallbackGrid} style={{ '--cells': String(GRID_SIZE) } as CSSProperties}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
            <div key={i} className={styles.cell} />
          ))}
        </div>
      ) : (
        <div ref={containerRef} className={styles.boardArea} />
      )}
    </section>
  );
}
