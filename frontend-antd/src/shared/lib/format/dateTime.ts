import { EMPTY_VALUE } from './bytes';

import { getLocale } from '@/shared/i18n';

/** Short date and time, in the active locale unless another BCP 47 tag is given. */
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
