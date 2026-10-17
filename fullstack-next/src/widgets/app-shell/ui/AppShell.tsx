'use client';

import { Alert, Layout, Menu, Typography } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { ProfileMenu, useAuth } from '@/features/auth';

import { visibleNavEntries } from '../model/navigation';

/**
 * Оболочка авторизованной части: шапка с навигацией и меню профиля, контент
 * страницы и баннер, если сессию не удалось проверить.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const items = visibleNavEntries(auth.user).map((entry) => ({ key: entry.href, label: entry.title }));

  // `proxy.ts` пропускает запрос по наличию cookie. Если cookie есть, но сессия
  // на бэкенде истекла, профиль вернёт 401 — тогда отправляем на экран входа.
  useEffect(() => {
    if (auth.status === 'anonymous') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
          User Kit
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[pathname]}
          items={items}
          onClick={({ key }) => router.push(key)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <ProfileMenu />
      </Layout.Header>
      <Layout.Content style={{ padding: '2rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {auth.status === 'error' && (
            <Alert
              type="error"
              showIcon
              title="Не удалось проверить сессию"
              description={auth.failure}
              style={{ marginBottom: 16 }}
            />
          )}
          {children}
        </div>
      </Layout.Content>
    </Layout>
  );
}
