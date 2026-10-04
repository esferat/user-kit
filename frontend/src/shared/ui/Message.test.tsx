import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Message } from './Message';

import { MESSAGE_DESIGN } from '@/shared/lib';

describe('Message', () => {
  it('shows the text of the message', () => {
    const { container } = render(<Message text="Файл удалён" design="Success" />);

    expect(container.querySelector('ui5-message-strip')?.textContent).toBe('Файл удалён');
  });

  it.each([
    ['Information', 'Information'],
    ['Success', 'Positive'],
    ['Warning', 'Critical'],
    ['Error', 'Negative'],
  ] as const)('maps the design %s to %s', (design, expected) => {
    const { container } = render(<Message text="Текст" design={design} />);

    expect(MESSAGE_DESIGN[design]).toBe(expected);
    expect((container.querySelector('ui5-message-strip') as HTMLElement & { design: string }).design).toBe(expected);
  });
});
