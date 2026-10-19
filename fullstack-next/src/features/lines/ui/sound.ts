/**
 * Звук игры: синтезированные эффекты и лёгкая фоновая музыка на Web Audio.
 * Внешних файлов нет — всё генерируется осцилляторами. Контекст создаётся лениво
 * и «просыпается» первым жестом пользователя (политика автоплея браузеров).
 */

/** Длительность шага мелодии, секунды. */
const STEP = 0.42;
/** Насколько вперёд планируем ноты, секунды. */
const LOOKAHEAD = 0.4;
/** Мелодия: ноты в MIDI (C-dur пентатоника), -1 — пауза. */
const MELODY = [76, 79, 84, 81, 79, 76, 74, 76, 79, 83, 86, 83, 81, 79, 76, 72];
/** Басовая нота на выбранных шагах (индекс шага → MIDI). */
const BASS: Record<number, number> = {0: 52, 8: 50};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Синтезатор: шина музыки и шина эффектов с раздельной громкостью. */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private musicVolume: number;
  private sfxVolume: number;
  /** Кэш буфера белого шума для «топота». */
  private noiseBuffer: AudioBuffer | null = null;
  /** Чётность шага: чередуем высоту удара, чтобы топот не звучал метрономом. */
  private stepFlip = 0;

  constructor(musicVolume = 0.45, sfxVolume = 0.7) {
    this.musicVolume = clamp01(musicVolume);
    this.sfxVolume = clamp01(sfxVolume);
  }

  /** Ленивая инициализация аудиоконтекста. */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const musicBus = ctx.createGain();
    musicBus.gain.value = this.musicVolume;
    musicBus.connect(master);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this.sfxVolume;
    sfxBus.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.musicBus = musicBus;
    this.sfxBus = sfxBus;
    return ctx;
  }

  /** Возобновляет контекст после жеста пользователя. */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  setMusicVolume(value: number): void {
    this.musicVolume = clamp01(value);
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value);
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
  }

  /** Звук прыжка шара: короткий взлёт вверх и мягкий отскок вниз. */
  playJump(): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    this.sfxBlip(t, 300, 780, 0.13, 0.42);
    this.sfxBlip(t + 0.1, 720, 380, 0.12, 0.26);
  }

  /**
   * Топот шага: низкий глухой удар плюс короткий шумовой шлепок.
   * `strong` — «приземление» на последней клетке маршрута.
   */
  playStep(strong = false): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    // Чередуем высоту: два шага подряд звучат как ноги, а не как метроном.
    this.stepFlip = this.stepFlip === 0 ? 1 : 0;
    const base = (this.stepFlip === 0 ? 138 : 158) * (strong ? 0.85 : 1);
    this.sfxThud(t, base, 0.085, strong ? 0.5 : 0.36);
    this.sfxNoise(t, 0.05, 820, strong ? 0.3 : 0.2);
  }

  /** Звук списания линии: хлопок — стайка коротких шумовых всплесков. */
  playClear(): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    // Хлопок — не один удар, а несколько слипшихся всплесков шума.
    this.sfxClapBurst(t, 0.05, 1500, 0.42);
    this.sfxClapBurst(t + 0.012, 0.05, 1700, 0.3);
    this.sfxClapBurst(t + 0.026, 0.06, 1250, 0.22);
    // Короткий хвост — лёгкий шлепок после хлопка.
    this.sfxClapBurst(t + 0.05, 0.14, 900, 0.1);
  }

  /** Запускает лёгкую фоновую музыку (идемпотентно). */
  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.15;
    this.musicTimer = window.setInterval(() => this.pumpMusic(), 50);
    this.pumpMusic();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose(): void {
    this.stopMusic();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
  }

  /** Планирует ноты вперёд на LOOKAHEAD; пока контекст не запущен, ждёт. */
  private pumpMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    if (ctx.state !== 'running') {
      this.nextNoteTime = ctx.currentTime + 0.15;
      return;
    }
    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      const index = this.step % MELODY.length;
      const note = MELODY[index];
      if (note >= 0) this.musicNote(this.nextNoteTime, note, STEP * 0.95, 0.16, 'sine');
      const bass = BASS[index];
      if (bass !== undefined) this.musicNote(this.nextNoteTime, bass, STEP * 1.8, 0.12, 'triangle');
      this.nextNoteTime += STEP;
      this.step = (index + 1) % MELODY.length;
    }
  }

  private musicNote(time: number, midi: number, duration: number, peak: number, type: OscillatorType): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter).connect(gain).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private sfxBlip(time: number, from: number, to: number, duration: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  /** Глухой низкий удар: синус с быстрым падением высоты. */
  private sfxThud(time: number, from: number, duration: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(from * 0.5, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  /** Короткий шумовой шлепок поверх удара — придаёт топоту характер шага. */
  private sfxNoise(time: number, duration: number, cutoff: number, peak: number): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    const buffer = this.noise();
    if (!ctx || !bus || !buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter).connect(gain).connect(bus);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  /** Всплеск шума через полосовой фильтр — «ладони» в хлопке. */
  private sfxClapBurst(time: number, duration: number, freq: number, peak: number): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    const buffer = this.noise();
    if (!ctx || !bus || !buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter).connect(gain).connect(bus);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  /** Буфер белого шума: создаётся один раз и переиспользуется. */
  private noise(): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.25);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}
