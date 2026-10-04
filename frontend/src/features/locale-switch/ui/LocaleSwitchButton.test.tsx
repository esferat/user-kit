import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleSwitchButton } from './LocaleSwitchButton';

import { getLocale, i18n, localeName } from '@/shared/i18n';

function shellBarItem(container: HTMLElement): HTMLElement & { text: string } {
  return container.querySelector('ui5-shellbar-item') as HTMLElement & { text: string };
}

beforeEach(() => {
  i18n.setLocale('ru');
});

afterEach(() => {
  i18n.setLocale('ru');
  window.localStorage.clear();
});

describe('LocaleSwitchButton', () => {
  it('shows the language of the interface and announces the target', () => {
    const { container } = render(<LocaleSwitchButton />);

    expect(shellBarItem(container).text).toBe(localeName('ru'));
    expect(shellBarItem(container).getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: localeName('en') }));
  });

  it('switches to the other language and repaints itself', async () => {
    const { container } = render(<LocaleSwitchButton />);

    fireEvent.click(shellBarItem(container));

    await vi.waitFor(() => expect(getLocale()).toBe('en'));
    expect(shellBarItem(container).text).toBe(localeName('en'));
    expect(shellBarItem(container).getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: localeName('ru') }));
  });

  it('keeps the choice of the language', () => {
    const { container } = render(<LocaleSwitchButton />);

    fireEvent.click(shellBarItem(container));

    expect(window.localStorage.getItem('user-kit:locale')).toBe('en');
  });
});
