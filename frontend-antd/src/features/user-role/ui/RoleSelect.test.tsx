import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleSelect } from './RoleSelect';

import type { Role } from '@/entities/user';

import { i18n } from '@/shared/i18n';

const NAME = 'Роль';

/** The label of the option antd shows for a role. */
function optionOf(role: Role): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
    (entry) => entry.textContent === i18n.t(`roles.${role}`),
  );
}

function open(container: HTMLElement): void {
  fireEvent.mouseDown(container.querySelector('.ant-select-content') as Element);
}

function choose(container: HTMLElement, role: Role): void {
  open(container);
  const option = optionOf(role);
  if (option) {
    fireEvent.click(option);
  }
}

/** The trigger renders the label of the selected role. */
function shown(container: HTMLElement): string {
  return (container.querySelector('.ant-select-content') as HTMLElement).title;
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('RoleSelect', () => {
  it('offers the roles of the application', () => {
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={() => undefined} />);

    expect(container.querySelector('input[aria-label]')?.getAttribute('aria-label')).toBe(NAME);
    expect(shown(container)).toBe(i18n.t('roles.user'));
  });

  it('lists both roles when it is opened', () => {
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={() => undefined} />);

    open(container);

    expect([...document.querySelectorAll('.ant-select-item-option')].map((option) => option.textContent)).toEqual([
      i18n.t('roles.admin'),
      i18n.t('roles.user'),
    ]);
  });

  it('reports the selected role', () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={onChange} />);

    choose(container, 'admin');

    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('keeps the value that the current role already has', () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={onChange} />);

    choose(container, 'user');

    expect(onChange).not.toHaveBeenCalled();
  });
});
