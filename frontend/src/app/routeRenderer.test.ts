import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPageRenderer, prependLoginMessage } from './routeRenderer';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';
import { i18n } from '@/shared/i18n';

const fileApi = { list: vi.fn() } as unknown as FileApi;
const userApi = { list: vi.fn() } as unknown as UserApi;

describe('createPageRenderer', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('keeps the api instances of the shell for every route', () => {
    const context = createPageRenderer().create(fileApi, userApi);

    expect(context).toEqual({ fileApi, userApi });
  });

  it('renders the documents page for the documents route', () => {
    const renderer = createPageRenderer();
    const context = renderer.create(fileApi, userApi);

    const page = renderer.render('documents', context);

    expect(page.tagName.toLowerCase()).toBe('ui5-page');
    expect(page.textContent).toContain(i18n.t('documents.title'));
    expect(page.textContent).not.toContain(i18n.t('users.title'));
  });

  it('renders the administration page for the users route', () => {
    const renderer = createPageRenderer();
    const context = renderer.create(fileApi, userApi);

    const page = renderer.render('admin-users', context);

    expect(page.textContent).toContain(i18n.t('users.title'));
  });
});

describe('prependLoginMessage', () => {
  it('shows the message above the login screen', () => {
    const root = document.createElement('div');
    root.appendChild(document.createElement('ui5-card'));

    prependLoginMessage(root, i18n.t('app.sessionRestoreFailed'));

    const strip = root.querySelector('ui5-message-strip');
    expect(strip?.getAttribute('design')).toBe('Negative');
    expect(strip?.textContent).toBe(i18n.t('app.sessionRestoreFailed'));
    expect(root.firstElementChild).toBe(strip);
  });
});
