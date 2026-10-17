'use client';
import {useEffect, type ReactNode} from 'react';
import {useAuth} from "@/features/auth";
import {useRouter} from "next/navigation";
import {Alert} from "antd";

export function ProtectedAppShell({children}: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  // `proxy.ts` пропускает запрос по наличию cookie. Если cookie есть, но сессия
  // на бэкенде истекла, профиль вернёт 401 — тогда отправляем на экран входа.
  useEffect(() => {
    if (auth.status === 'anonymous') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  return (

    <div style={{maxWidth: 960, margin: '0 auto'}}>
      {auth.status === 'error' && (
        <Alert
          type="error"
          showIcon
          title="Не удалось проверить сессию"
          description={auth.failure}
          style={{marginBottom: 16}}
        />
      )}
      {children}
    </div>
  );
}