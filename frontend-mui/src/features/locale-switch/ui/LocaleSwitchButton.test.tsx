import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleSwitchButton } from './LocaleSwitchButton';

import { getLocale, i18n, localeName } from '@/shared/i18n';

function switchButton(container: HTMLElement): HTMLElement {
  return container.querySelector('button') as HTMLElement;
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

    expect(switchButton(container).textContent).toBe(localeName('ru'));
    expect(switchButton(container).getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: localeName('en') }));
  });

  it('switches to the other language and repaints itself', async () => {
    const { container } = render(<LocaleSwitchButton />);

    fireEvent.click(switchButton(container));

    await vi.waitFor(() => expect(getLocale()).toBe('en'));
    expect(switchButton(container).textContent).toBe(localeName('en'));
    expect(switchButton(container).getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: localeName('ru') }));
  });

  it('keeps the choice of the language', () => {
    const { container } = render(<LocaleSwitchButton />);

    fireEvent.click(switchButton(container));

    expect(window.localStorage.getItem('user-kit:locale')).toBe('en');
  });
});
