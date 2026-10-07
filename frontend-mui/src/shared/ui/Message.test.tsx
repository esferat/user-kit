import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Message } from './Message';

import { MESSAGE_DESIGN } from '@/shared/lib';

function alert(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="alert"]') as HTMLElement;
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
    const mapped = expected.charAt(0).toUpperCase() + expected.slice(1);
    expect(alert(container).classList.contains(`MuiAlert-standard${mapped}`)).toBe(true);
  });

  it('covers the four designs of the application with the four alert types', () => {
    expect(Object.keys(MESSAGE_DESIGN).sort()).toEqual(['Error', 'Information', 'Success', 'Warning']);
  });
});
