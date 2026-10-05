import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/shared/i18n';
import { EMPTY_VALUE, formatBytes, formatDateTime, initialsOf } from '@/shared/lib';

beforeEach(() => {
  i18n.setLocale('ru');
});

afterEach(() => {
  i18n.setLocale('ru');
});

describe('formatBytes', () => {
  it('formats plain bytes', () => {
    expect(formatBytes(0)).toBe(`0 ${i18n.t('format.units.bytes')}`);
    expect(formatBytes(512)).toBe(`512 ${i18n.t('format.units.bytes')}`);
  });

  it('formats larger units', () => {
    expect(formatBytes(1024)).toBe(`1.0 ${i18n.t('format.units.kb')}`);
    expect(formatBytes(1536)).toBe(`1.5 ${i18n.t('format.units.kb')}`);
    expect(formatBytes(1024 ** 2 * 5)).toBe(`5.0 ${i18n.t('format.units.mb')}`);
    expect(formatBytes(1024 ** 3 * 2.25)).toBe(`2.3 ${i18n.t('format.units.gb')}`);
  });

  it('uses the units of the active locale', () => {
    i18n.setLocale('en');
    expect(formatBytes(1024 ** 2 * 5)).toBe('5.0 MB');

    i18n.setLocale('ru');
    expect(formatBytes(1024 ** 2 * 5)).toBe(`5.0 ${i18n.t('format.units.mb')}`);
  });

  it('returns a placeholder for invalid input', () => {
    expect(formatBytes(Number.NaN)).toBe(EMPTY_VALUE);
    expect(formatBytes(-1)).toBe(EMPTY_VALUE);
  });
});

describe('formatDateTime', () => {
  it('formats an ISO timestamp', () => {
    expect(formatDateTime('2026-03-04T10:15:00Z', 'en-GB')).toMatch(/2026/);
  });

  it('follows the active locale', () => {
    i18n.setLocale('ru');
    const russian = formatDateTime('2026-03-04T10:15:00Z');

    i18n.setLocale('en');
    expect(formatDateTime('2026-03-04T10:15:00Z')).not.toBe(russian);
  });

  it('returns a placeholder for empty or invalid values', () => {
    expect(formatDateTime(null)).toBe(EMPTY_VALUE);
    expect(formatDateTime(undefined)).toBe(EMPTY_VALUE);
    expect(formatDateTime('')).toBe(EMPTY_VALUE);
    expect(formatDateTime('not-a-date')).toBe(EMPTY_VALUE);
  });
});

describe('initialsOf', () => {
  it('takes the first and the last word', () => {
    expect(initialsOf('Jane Doe')).toBe('JD');
    expect(initialsOf('  jane   middleton  doe ')).toBe('JD');
  });

  it('handles single names and empty input', () => {
    expect(initialsOf('root')).toBe('R');
    expect(initialsOf('   ')).toBe('?');
  });
});
