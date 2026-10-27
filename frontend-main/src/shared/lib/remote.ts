import type { ComponentType } from 'react';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import { appConfig } from '@/shared/config';

/** Имя remote и имя expose — ровно как в `module-federation.config.ts` user-profile. */
const REMOTE_NAME = 'user_profile';
const REMOTE_EXPOSE = `${REMOTE_NAME}/ProfileEdit`;

/** Компонент, который публикует remote: форма правки профиля без обязательных пропов. */
export type RemoteProfileEdit = ComponentType<{ onSaved?: () => void | Promise<void> }>;

let federationStarted = false;

/**
 * Готовит share scope хоста и подключает remote.
 *
 * React и ReactDOM регистрируются как singleton с готовым значением (`lib`),
 * и это принципиально: без общего экземпляра компонент remote работал бы со
 * своим React и падал бы на хуках с «invalid hook call». Запись со `loaded`
 * (её даёт `lib`) не вытесняется при инициализации remote, поэтому хост
 * остаётся владельцем экземпляра фреймворка.
 *
 * antd намеренно не шарится: у remote он собран своей копией с внутренними
 * `rc-*`, а шаринг привязал бы хост к версии из `package.json` remote.
 *
 * `react-dom/client` регистрируется отдельным ключом: точное совпадение
 * `react-dom` sub-path не покрывает, и без этой записи remote собрал бы свою
 * копию клиентского рендерера. Его проверка `react.version === своя версия`
 * и падала: хост отдаёт React, вшитый в Next (canary), а remote — npm-сборку.
 * Подробности: module-federation/core#4727.
 */
async function startFederation(): Promise<void> {
  if (federationStarted) {
    return;
  }
  federationStarted = true;

  // Рантайм подгружается только на клиенте: на сервере ему нечего делать,
  // а страница его и не вызывает (загрузка идёт в эффекте). Тот же приём и для
  // react-dom/client: у его типов нет поля version, версия берётся у пакета
  // react-dom — это одна и та же сборка.
  const { init } = await import('@module-federation/runtime');
  const ReactDomClient = await import('react-dom/client');

  init({
    name: 'frontend_main',
    remotes: [
      { name: REMOTE_NAME, entry: `${appConfig.profileBaseUrl}/static/mf-manifest.json` },
    ],
    // Стратегия выбора провайдера: уже загруженный экземпляр важнее версии.
    // Дефолт `version-first` мог подставить remote-копию, если бы та оказалась
    // «новее», а пара react/react-dom должна быть всегда одна — хостовая.
    shareStrategy: 'loaded-first',
    shared: {
      react: {
        version: React.version,
        lib: () => React,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      'react-dom': {
        version: ReactDom.version,
        lib: () => ReactDom,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      'react-dom/client': {
        version: ReactDom.version,
        lib: () => ReactDomClient,
        shareConfig: { singleton: true, requiredVersion: false },
      },
    },
  });
}

/**
 * Загружает компонент из микрофронтенда `user-profile`.
 *
 * Вызывается только на клиенте: manifest и чанки remote живут на другом домене,
 * сервер их не видит. Ошибка сети или отсутствующий expose превращаются в
 * обычное отклонение промиса — страница показывает запасной вариант.
 */
export async function loadProfileEdit(): Promise<RemoteProfileEdit> {
  await startFederation();

  const { loadRemote } = await import('@module-federation/runtime');
  const exposed = await loadRemote<unknown>(REMOTE_EXPOSE);

  // expose — ESM-модуль с default-экспортом, но рантайм может отдать и сам
  // компонент, поэтому проверяются оба варианта.
  const component =
    typeof exposed === 'function'
      ? exposed
      : ((exposed as { default?: unknown } | null)?.default ?? null);

  if (typeof component !== 'function') {
    throw new Error(`Микрофронтенд user-profile не отдал компонент ${REMOTE_EXPOSE}`);
  }

  return component as RemoteProfileEdit;
}
