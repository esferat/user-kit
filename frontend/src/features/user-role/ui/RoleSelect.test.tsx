import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleSelect } from './RoleSelect';

import type { Role } from '@/entities/user';

import { i18n } from '@/shared/i18n';

function change(select: Element, value: string): void {
  fireEvent(select, new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value } } }));
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('RoleSelect', () => {
  it('offers the roles of the application', () => {
    const { container } = render(<RoleSelect value="user" accessibleName="Роль" onChange={() => undefined} />);

    const select = container.querySelector('ui5-select') as HTMLElement & { value: string };
    expect(select.getAttribute('accessible-name')).toBe('Роль');
    // React assigns `value` to the element itself, UI5 only mirrors it into the
    // attribute when it renders the options.
    expect(select.value).toBe('user');
    expect([...container.querySelectorAll('ui5-option')].map((option) => option.textContent)).toEqual([
      i18n.t('roles.admin'),
      i18n.t('roles.user'),
    ]);
  });

  it('reports the selected role', () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName="Роль" onChange={onChange} />);

    change(container.querySelector('ui5-select') as Element, 'admin');

    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('ignores a value that is not a role', () => {
    const onChange = vi.fn<(role: Role) => void>();
    const { container } = render(<RoleSelect value="user" accessibleName="Роль" onChange={onChange} />);

    change(container.querySelector('ui5-select') as Element, 'superuser');

    expect(onChange).not.toHaveBeenCalled();
  });
});
