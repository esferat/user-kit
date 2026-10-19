/** Детерминированный генератор случайных чисел (mulberry32). */
export type Rng = () => number;

/** Одинаковый seed даёт одинаковый поток «случайностей» — так сколы плиток воспроизводимы. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Случайное число из диапазона [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
