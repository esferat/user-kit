'use client';

import { MOCK_ATTEMPTS } from '../mock';
import styles from '../LinesGame.module.css';

/** Правый блок: список лучших попыток (пока мок-данные). */
export function AttemptsPanel() {
  return (
    <aside className={`${styles.panel} ${styles.attemptsPanel}`}>
      <div className={styles.attemptsHeader}>
        <span aria-hidden className={styles.trophyIcon}>
          🏆
        </span>
        <span className={styles.attemptsHeading}>Лучшие попытки</span>
      </div>
      <div className={styles.attemptsList}>
        {MOCK_ATTEMPTS.map((entry, idx) => (
          <div key={`${entry.name}-${idx}`} className={styles.attemptRow}>
            <span className={styles.rankBadge} data-rank={idx}>
              {idx + 1}
            </span>
            <span className={styles.attemptName}>{entry.name}</span>
            <strong className={styles.attemptScore}>{entry.score}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}
