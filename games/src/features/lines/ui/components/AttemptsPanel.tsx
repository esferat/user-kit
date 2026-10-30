'use client';

import { DIFFICULTY_LABELS } from '../../game/constants';
import type { AttemptEntry } from '../../game/statsStorage';
import styles from '../LinesGame.module.css';

interface AttemptsPanelProps {
  /** Лучшие попытки из localStorage; пусто — таблица ещё не заполнена. */
  attempts: AttemptEntry[];
}

/** Правый блок: список лучших попыток, сохранённых в браузере. */
export function AttemptsPanel({ attempts }: AttemptsPanelProps) {
  return (
    <aside className={`${styles.panel} ${styles.attemptsPanel}`}>
      <div className={styles.attemptsHeader}>
        <span aria-hidden className={styles.trophyIcon}>
          🏆
        </span>
        <span className={styles.attemptsHeading}>Лучшие попытки</span>
      </div>
      {attempts.length === 0 ? (
        <p className={styles.attemptsEmpty}>Пока пусто — сыграйте партию до конца.</p>
      ) : (
        <div className={styles.attemptsList}>
          {attempts.map((entry, idx) => (
            <div key={`${entry.at}-${idx}`} className={styles.attemptRow}>
              <span className={styles.rankBadge} data-rank={idx}>
                {idx + 1}
              </span>
              <span className={styles.attemptName}>{DIFFICULTY_LABELS[entry.difficulty]}</span>
              <strong className={styles.attemptScore}>{entry.score}</strong>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
