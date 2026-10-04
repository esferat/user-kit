import { t } from '@/shared/i18n';

const UNIT_KEYS = [
  'format.units.bytes',
  'format.units.kb',
  'format.units.mb',
  'format.units.gb',
  'format.units.tb',
] as const;

/** Shortened decimal size, e.g. `1.5 МБ` / `1.5 MB`. */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return EMPTY_VALUE;
  }
  if (bytes < 1024) {
    return `${bytes} ${t(UNIT_KEYS[0])}`;
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNIT_KEYS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(fractionDigits)} ${t(UNIT_KEYS[unitIndex])}`;
}

/** Rendered instead of a value that cannot be formatted. */
export const EMPTY_VALUE = '—';
