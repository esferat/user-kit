'use client';

import { Modal, Typography } from 'antd';

import styles from '../LinesGame.module.css';
import { DARK_MODAL_STYLES } from '../modalTheme';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

/** Окно помощи: краткие правила будущей игры. */
export function RulesModal({ open, onClose }: RulesModalProps) {
  return (
    <Modal
      title="Правила игры"
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      styles={DARK_MODAL_STYLES}
    >
      <div className={styles.rulesBody}>
        <Typography.Paragraph className={styles.paragraph}>
          Если ход не списал шары, на поле падают новые шары: их цвета видны в панели «Дальше», а
          клетки падения отмечены маленькими шариками. Ходу они не мешают — если клетку займёт шар,
          новый шар упадёт на другую случайную свободную клетку.
        </Typography.Paragraph>
        <Typography.Paragraph className={styles.paragraph}>
          Выберите шар щелчком — он подпрыгивает. Клик по свободной клетке сразу отправляет шар
          в путь: жёлтые отпечатки ног под курсором показывают маршрут, а кольцо отмечает цель.
          Подтверждать ход не нужно. Шар идёт только по вертикали и горизонтали через свободные
          клетки; если пути нет, движение не выполняется.
        </Typography.Paragraph>
        <Typography.Paragraph className={styles.paragraph}>
          Кнопка <strong className={styles.highlight}>💡</strong> подсвечивает белым полезный
          маршрут — ход, который собирает 5 шаров в линию. Выделение любого шара убирает подсказку.
        </Typography.Paragraph>
        <Typography.Paragraph className={styles.paragraph}>
          Линия из <strong className={styles.highlight}>5 и более</strong> шаров одного цвета по
          горизонтали, вертикали или диагонали списывается. Если линии одного цвета пересекаются,
          списываются <strong className={styles.highlight}>обе</strong> — независимо от их
          направления, но в каждой линии должно быть хотя бы по 5 шаров. Чем длиннее линия, тем
          больше очков, а несколько линий за один ход дают бонус.
        </Typography.Paragraph>
        <Typography.Paragraph className={styles.paragraph}>
          Списание даёт дополнительный ход: новые шары не падают, а предсказание остаётся прежним.
        </Typography.Paragraph>
        <Typography.Paragraph className={styles.paragraph}>
          Игра заканчивается, когда ни один шар не может сделать ход.
        </Typography.Paragraph>
      </div>
    </Modal>
  );
}
