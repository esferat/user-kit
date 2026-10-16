import { createContext } from 'react';

import type { SessionStore } from './sessionStore';

/**
 * Контекст со стором сессии. Заполняется `AuthSessionProvider` из слоя `ui`,
 * потребители работают с ним через хук `useAuth`.
 */
export const AuthContext = createContext<SessionStore | null>(null);
