'use client';

import { Layout, Menu, Typography, type MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ProfileMenu, useAuth } from '@/features/auth';
import { isNavGroup, openGroupKeys, visibleNavEntries, type NavEntry } from '../model/navigation';

/** Пункты модели навигации превращаются в подпункты меню antd. */
function toMenuItems(entries: readonly NavEntry[]): NonNullable<MenuProps['items']> {
  return entries.map((entry) =>
    isNavGroup(entry)
      ? {
          key: entry.id,
          label: entry.title,
          children: entry.children.map((child) => ({ key: child.href, label: child.title })),
        }
      : { key: entry.href, label: entry.title },
  );
}

/**
 * Оболочка приложения: шапка с брендом и профилем, навигация — в левом боковом
 * меню. У анонимного посетителя меню пустое, тогда и колонка не рисуется.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const items = toMenuItems(visibleNavEntries(auth.user));
  // Группа со страницей, открытой по прямой ссылке, должна быть раскрыта сразу.
  // Дальше раскрытием управляет сам antd: заход в игру возможен только из меню.
  const [defaultOpenKeys] = useState(() => openGroupKeys(pathname));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href={`/`}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
            User Kit
          </Typography.Title>
        </Link>
        <div style={{ flex: 1 }}/>
        <ProfileMenu/>
      </Layout.Header>
      <Layout>
        {items.length > 0 && (
          <Layout.Sider theme="dark" width={220}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[pathname]}
              defaultOpenKeys={defaultOpenKeys}
              items={items}
              // Клик по группе только раскрывает подменю: у неё нет своего
              // маршрута, поэтому переходим лишь по ключам-путям. Абсолютная
              // ссылка ведёт на домен игр — router.push ей не подходит.
              onClick={({ key }) => {
                if (key.startsWith('https://')) {
                  window.location.assign(key);
                } else if (key.startsWith('/')) {
                  router.push(key);
                }
              }}
              style={{ borderInlineEnd: 0 }}
            />
          </Layout.Sider>
        )}
        <Layout.Content style={{ padding: '2rem' }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
