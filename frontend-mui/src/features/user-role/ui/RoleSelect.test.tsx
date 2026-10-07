import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleSelect } from './RoleSelect';

import type { Role } from '@/entities/user';

import { i18n } from '@/shared/i18n';

const NAME = 'Роль';

function select(container: HTMLElement): HTMLElement {
  return container.querySelector('.MuiSelect-select[aria-label]') as HTMLElement;
}

function selectedRole(container: HTMLElement): string {
  return (container.querySelector('.MuiSelect-nativeInput') as HTMLInputElement).value;
}

/** Опции Material UI рендерятся в portal в конце body. */
function optionOf(role: Role): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.MuiMenuItem-root')].find(
    (entry) => entry.textContent === i18n.t(`roles.${role}`),
  );
}

function open(container: HTMLElement): void {
  fireEvent.mouseDown(select(container));
}

async function choose(container: HTMLElement, role: Role): Promise<void> {
  open(container);
  const option = await waitFor(() => optionOf(role));
  if (option) {
    fireEvent.click(option);
  }
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('RoleSelect', () => {
  it('offers the selected role of the application', () => {
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={() => undefined} />);

    expect(select(container).getAttribute('aria-label')).toBe(NAME);
    expect(selectedRole(container)).toBe('user');
  });

  it('lists both roles when it is opened', async () => {
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={() => undefined} />);

    open(container);

    await waitFor(() =>
      expect([...document.querySelectorAll('.MuiMenuItem-root')].map((option) => option.textContent)).toEqual([
        i18n.t('roles.admin'),
        i18n.t('roles.user'),
      ]),
    );
  });

  it('reports the selected role', async () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={onChange} />);

    await choose(container, 'admin');

    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('keeps the value that the current role already has', async () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName={NAME} onChange={onChange} />);

    await choose(container, 'user');

    expect(onChange).not.toHaveBeenCalled();
  });
});
