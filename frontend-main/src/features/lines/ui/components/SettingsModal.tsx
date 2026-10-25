'use client';

import { Modal, Segmented, Slider, Typography } from 'antd';

import {
  DIFFICULTY_LABELS,
  LINES_DIFFICULTIES,
  LINES_LEVELS,
  type LinesDifficulty,
  type LinesSettings,
} from '../../game/constants';
import styles from '../LinesGame.module.css';
import { DARK_MODAL_STYLES } from '../modalTheme';

interface SettingsModalProps {
  open: boolean;
  /** Черновик настроек: редактируется до нажатия «Применить». */
  draft: LinesSettings;
  onDraftChange: (next: LinesSettings) => void;
  onApply: () => void;
  onCancel: () => void;
}

const percent = (value?: number) => `${Math.round((value ?? 0) * 100)}%`;

/** Окно настроек игры: сложность и раздельная громкость музыки и звуков. */
export function SettingsModal({ open, draft, onDraftChange, onApply, onCancel }: SettingsModalProps) {
  const level = LINES_LEVELS[draft.difficulty];

  return (
    <Modal
      title="Настройки игры"
      open={open}
      onOk={onApply}
      onCancel={onCancel}
      okText="Применить"
      cancelText="Отмена"
      styles={DARK_MODAL_STYLES}
    >
      <div className={styles.modalBody}>
        <div>
          <Typography.Text className={styles.fieldLabel}>Сложность</Typography.Text>
          <Segmented
            block
            className={styles.segmented}
            options={LINES_DIFFICULTIES.map((key) => ({ label: DIFFICULTY_LABELS[key], value: key }))}
            value={draft.difficulty}
            onChange={(value) => onDraftChange({ ...draft, difficulty: value as LinesDifficulty })}
          />
          <Typography.Text className={styles.fieldHint}>
            {level.ballsPerTurn} {level.ballsPerTurn < 5 ? 'шара' : 'шаров'} за ход · {level.colors}{' '}
            {level.colors < 5 ? 'цвета' : 'цветов'} на поле
          </Typography.Text>
        </div>
        <div>
          <Typography.Text className={styles.fieldLabel}>Громкость музыки</Typography.Text>
          <Slider
            className={styles.slider}
            min={0}
            max={1}
            step={0.05}
            value={draft.musicVolume}
            tooltip={{ formatter: percent }}
            onChange={(value: number) => onDraftChange({ ...draft, musicVolume: value })}
          />
        </div>
        <div>
          <Typography.Text className={styles.fieldLabel}>Громкость звуков</Typography.Text>
          <Slider
            className={styles.slider}
            min={0}
            max={1}
            step={0.05}
            value={draft.sfxVolume}
            tooltip={{ formatter: percent }}
            onChange={(value: number) => onDraftChange({ ...draft, sfxVolume: value })}
          />
        </div>
      </div>
    </Modal>
  );
}
