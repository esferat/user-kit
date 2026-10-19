'use client';

import { Modal, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LinesBoard } from '../game/board';
import { DEFAULT_SETTINGS, type LinesDifficulty, type LinesSettings } from '../game/constants';
import { applyMove, createGame, EMPTY, findHint, findPath, type LinesHint, type LinesState } from '../game/engine';
import { loadSettings, saveSettings } from '../game/settingsStorage';
import { loadAttempts, recordAttempt, type AttemptEntry } from '../game/statsStorage';
import { AttemptsPanel } from './components/AttemptsPanel';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { TopBar } from './components/TopBar';
import styles from './LinesGame.module.css';
import { DARK_MODAL_STYLES } from './modalTheme';
import { SoundEngine } from './sound';

/** Игра «Цветные линии»: страница собирает верхний блок, поле и таблицу попыток. */
export function LinesGame() {
  const [settings, setSettings] = useState<LinesSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<LinesSettings>(DEFAULT_SETTINGS);
  const [game, setGame] = useState<LinesState>(() => createGame(DEFAULT_SETTINGS.difficulty));
  const [selected, setSelected] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  /** Маршрут подсказки: белый путь полезного хода, виден, пока ничего не выделено. */
  const [hint, setHint] = useState<LinesHint | null>(null);
  /** Лучшие попытки из localStorage: на старте список пустой. */
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);

  // Ход асинхронный (анимации на доске): читаем актуальное состояние через ref.
  const gameRef = useRef(game);
  const selectedRef = useRef(selected);
  const busyRef = useRef(false);
  // Клетка, до которой маршрут уже зафиксирован первым кликом.
  const pendingRef = useRef<number | null>(null);
  // Звук создаётся лениво, когда понадобится (первый выбор шара или первый жест).
  const soundRef = useRef<SoundEngine | null>(null);
  const musicVolRef = useRef(settings.musicVolume);
  const sfxVolRef = useRef(settings.sfxVolume);
  useEffect(() => {
    gameRef.current = game;
    selectedRef.current = selected;
  }, [game, selected]);

  const getSound = useCallback(() => {
    if (!soundRef.current) {
      soundRef.current = new SoundEngine(musicVolRef.current, sfxVolRef.current);
    }
    return soundRef.current;
  }, []);

  // Громкости применяются сразу, без перезапуска партии.
  useEffect(() => {
    musicVolRef.current = settings.musicVolume;
    sfxVolRef.current = settings.sfxVolume;
    soundRef.current?.setMusicVolume(settings.musicVolume);
    soundRef.current?.setSfxVolume(settings.sfxVolume);
  }, [settings]);

  // Музыка стартует после первого жеста: до него браузер не даёт играть звук.
  useEffect(() => {
    const startAudio = () => {
      const engine = getSound();
      engine.resume();
      engine.startMusic();
    };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
  }, [getSound]);

  // Освобождаем аудиоконтекст при уходе со страницы.
  useEffect(
    () => () => {
      soundRef.current?.dispose();
      soundRef.current = null;
    },
    [],
  );

  // Сохранённые настройки и статистику подхватываем один раз при монтировании:
  // SSR хранилища не видит, поэтому читаем после маунта.
  useEffect(() => {
    const stored = loadSettings();
    const stats = loadAttempts();
    setTimeout(() => {
      if (stored) {
        setSettings(stored);
        setDraft(stored);
        if (stored.difficulty !== gameRef.current.difficulty) {
          setGame(createGame(stored.difficulty));
        }
      }
      if (stats.length > 0) setAttempts(stats);
    }, 0);
  }, []);

  const startGame = useCallback((difficulty: LinesDifficulty) => {
    pendingRef.current = null;
    setGame(createGame(difficulty));
    setSelected(null);
    setGameOverOpen(false);
    setHintOn(false);
    setHint(null);
  }, []);

  /**
   * Клик по клетке: выбор шара, фиксация маршрута или подтверждение хода.
   * Первый клик по свободной клетке строит маршрут, повторный по той же —
   * выполняет движение, клик по другой клетке перестраивает маршрут.
   */
  const handleCellClick = useCallback((cell: number, board: LinesBoard) => {
    if (busyRef.current || gameRef.current.status === 'over') return;
    const state = gameRef.current;

    if (state.board[cell] !== EMPTY) {
      // Клик по шару: выбрать или снять выделение.
      const next = selectedRef.current === cell ? null : cell;
      selectedRef.current = next;
      pendingRef.current = null;
      setSelected(next);
      if (next !== null) {
        // Выделение любого шара гасит белый маршрут подсказки.
        setHintOn(false);
        setHint(null);
        // Шар подпрыгнул — играем звук прыжка.
        getSound().playJump();
      }
      return;
    }

    const from = selectedRef.current;
    if (from === null) return;

    // Маршрут — только вертикально и горизонтально через свободные клетки.
    const path = findPath(state, from, cell);

    if (pendingRef.current !== cell) {
      // Первый клик по клетке (или клик по другой): фиксируем новый маршрут.
      if (!path) {
        pendingRef.current = null;
        board.setRouteTarget(null);
        return;
      }
      pendingRef.current = cell;
      board.setRouteTarget(cell);
      return;
    }

    // Повторный клик по той же клетке — подтверждение маршрута.
    if (!path) return;
    pendingRef.current = null;

    busyRef.current = true;
    void (async () => {
      const sound = getSound();
      // Топот шагов по клеткам; шаг на конечную клетку — тяжелее (приземление).
      await board.animateMove(path, (index) => sound.playStep(index === path.length - 1));
      const outcome = applyMove(state, from, cell);
      // Линия списалась — хлопок звучит в момент очистки.
      if (outcome.cleared.length > 0) sound.playClear();
      await board.animateClear(outcome.cleared);
      setGame(outcome.state);
      setSelected(null);
      // Синхронизируем сцену сразу: шарики спавна нужны для animateSpawn.
      gameRef.current = outcome.state;
      selectedRef.current = null;
      board.sync(outcome.state.board, outcome.state.nextCells, outcome.state.nextColors, null);
      await board.animateSpawn(outcome.spawned);
      busyRef.current = false;
      if (outcome.state.status === 'over') {
        setGameOverOpen(true);
        // Партия закончилась — добавляем результат в лучшие попытки.
        setAttempts(
          recordAttempt({
            score: outcome.state.score,
            difficulty: outcome.state.difficulty,
            at: Date.now(),
          }),
        );
      }
    })();
  }, [getSound]);

  const openSettings = () => {
    setDraft(settings);
    setSettingsOpen(true);
  };

  /**
   * Применение настроек: громкости вступают сразу, а смена сложности меняет
   * правила — тогда начинаем партию заново.
   */
  const applySettings = () => {
    pendingRef.current = null;
    setSettings(draft);
    saveSettings(draft);
    if (draft.difficulty !== settings.difficulty) {
      setGame(createGame(draft.difficulty));
      setSelected(null);
      setHintOn(false);
      setHint(null);
    }
    setSettingsOpen(false);
  };

  /** Сброс: новая партия с текущей сложностью. */
  const resetGame = () => {
    startGame(settings.difficulty);
  };

  /**
   * Подсказка: показывает белым маршрут полезного хода. Повторное нажатие гасит её,
   * выделение любого шара тоже. При показе выделение снимается, чтобы маршрут был виден.
   */
  const toggleHint = () => {
    pendingRef.current = null;
    selectedRef.current = null;
    setSelected(null);
    if (hintOn) {
      setHintOn(false);
      setHint(null);
      return;
    }
    const found = findHint(gameRef.current);
    setHint(found);
    setHintOn(found !== null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.mainColumn}>
        <TopBar
          score={game.score}
          nextBalls={game.nextColors}
          hintOn={hintOn}
          onHintToggle={toggleHint}
          onReset={resetGame}
          onSettings={openSettings}
          onHelp={() => setHelpOpen(true)}
        />
        <GameBoard
          state={game}
          selected={selected}
          hintPath={hint?.path ?? null}
          onCellClick={handleCellClick}
        />
      </div>

      <AttemptsPanel attempts={attempts} />

      <SettingsModal
        open={settingsOpen}
        draft={draft}
        onDraftChange={setDraft}
        onApply={applySettings}
        onCancel={() => setSettingsOpen(false)}
      />
      <RulesModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Modal
        title="Игра окончена"
        open={gameOverOpen}
        onOk={() => startGame(settings.difficulty)}
        onCancel={() => setGameOverOpen(false)}
        okText="Новая игра"
        cancelText="Закрыть"
        styles={DARK_MODAL_STYLES}
      >
        <div className={styles.modalBody}>
          <Typography.Paragraph className={styles.paragraph}>
            Ни один шар больше не может сделать ход. Набрано очков:{' '}
            <strong className={styles.highlight}>{game.score}</strong>.
          </Typography.Paragraph>
        </div>
      </Modal>
    </div>
  );
}

export default LinesGame;
