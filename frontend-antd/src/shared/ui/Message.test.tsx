import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Message } from './Message';

import { MESSAGE_DESIGN } from '@/shared/lib';

function alert(container: HTMLElement): HTMLElement {
  return container.querySelector('.ant-alert') as HTMLElement;
}

describe('Message', () => {
  it('shows the text of the message', () => {
    const { container } = render(<Message text="Файл удалён" design="Success" />);

    expect(alert(container).textContent).toBe('Файл удалён');
  });

  it.each([
    ['Information', 'info'],
    ['Success', 'success'],
    ['Warning', 'warning'],
    ['Error', 'error'],
  ] as const)('maps the design %s to %s', (design, expected) => {
    const { container } = render(<Message text="Текст" design={design} />);

    expect(MESSAGE_DESIGN[design]).toBe(expected);
    expect(alert(container).classList.contains(`ant-alert-${expected}`)).toBe(true);
  });

  it('covers the four designs of the application with the four alert types', () => {
    expect(Object.keys(MESSAGE_DESIGN).sort()).toEqual(['Error', 'Information', 'Success', 'Warning']);
  });
});
