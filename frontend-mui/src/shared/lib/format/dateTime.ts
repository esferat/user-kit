import { EMPTY_VALUE } from './bytes';

import { getLocale } from '@/shared/i18n';

/** Короткие дата и время, в активной локали, если не задан другой тег BCP 47. */
export function formatDateTime(value: string | null | undefined, locale: string = getLocale()): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
