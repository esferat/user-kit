import { en } from './en';
import { ru } from './ru';

import type { Locale, Messages } from '../i18n';

/** All dictionaries of the application, keyed by locale. */
export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, ru };

export { en, ru };
