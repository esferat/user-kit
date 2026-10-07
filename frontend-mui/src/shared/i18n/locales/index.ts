import { en } from './en';
import { ru } from './ru';

import type { Locale, Messages } from '../i18n';

/** Все словари приложения, ключи — локали. */
export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, ru };

export { en, ru };
