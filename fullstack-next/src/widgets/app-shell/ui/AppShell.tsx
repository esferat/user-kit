'use client';

import {Layout, Menu, Typography} from 'antd';
import {usePathname, useRouter} from 'next/navigation';
import {type ReactNode} from 'react';
import {ProfileMenu, useAuth} from '@/features/auth';
import {visibleNavEntries} from '../model/navigation';
import Link from "next/link";

export function AppShell({children}: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const items = visibleNavEntries(auth.user).map((entry) => ({key: entry.href, label: entry.title}));

  return (
    <Layout style={{minHeight: '100vh'}}>
      <Layout.Header style={{display: 'flex', alignItems: 'center', gap: 24}}>
        <Link href={`/`}>
          <Typography.Title level={4} style={{color: '#fff', margin: 0, whiteSpace: 'nowrap'}}>
            User Kit
          </Typography.Title>
        </Link>
        <Menu
          theme="dark"
          mode="vertical"
          selectedKeys={[pathname]}
          items={items}
          onClick={({key}) => router.push(key)}
          style={{flex: 1, minWidth: 0}}
        />
        <ProfileMenu/>
      </Layout.Header>
      <Layout.Content style={{padding: '2rem'}}>
          {children}
      </Layout.Content>
    </Layout>
  );
}
