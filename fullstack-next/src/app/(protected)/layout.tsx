import type { ReactNode } from 'react';

import { AppShell } from '@/widgets/app-shell';

/**
 * Оболочка приватной части приложения: проверку сессии делает `proxy.ts`,
 * настоящий доступ к данным — бэкенд.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
