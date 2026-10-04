import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoleSelect, roleSelectCell } from './roleSelect';

import { ROLES, roleLabel, type Role } from '@/entities/user';
import { i18n } from '@/shared/i18n';

type SelectElement = Element & { value: string };

describe('createRoleSelect', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('offers every role of the domain in the order of the model', () => {
    const select = createRoleSelect({ value: 'user', accessibleName: 'Роль', onChange: vi.fn() });

    const options = [...select.querySelectorAll('ui5-option')] as (Element & { value: string })[];
    expect(options.map((option) => option.value)).toEqual([...ROLES]);
    expect(options.map((option) => option.textContent)).toEqual(ROLES.map((role) => roleLabel(role)));
    expect(select.accessibleName).toBe('Роль');
    expect(select.value).toBe('user');
  });

  it('preselects the given role', () => {
    const select = createRoleSelect({ value: 'admin', accessibleName: 'Роль', onChange: vi.fn() });

    expect(select.value).toBe('admin');
  });

  it('reports a selected role and keeps it as the current value', () => {
    const onChange = vi.fn<(role: Role) => void>();
    const select = createRoleSelect({ value: 'user', accessibleName: 'Роль', onChange });

    const selected = [...select.querySelectorAll('ui5-option')].find(
      (option) => (option as Element & { value: string }).value === 'admin',
    );
    select.dispatchEvent(new CustomEvent('change', { detail: { selectedOption: selected } }));

    expect(onChange).toHaveBeenCalledWith('admin');
    expect(select.value).toBe('admin');
  });

  it('ignores a change event without a usable option', () => {
    const onChange = vi.fn();
    const select = createRoleSelect({ value: 'user', accessibleName: 'Роль', onChange });

    select.dispatchEvent(new CustomEvent('change', { detail: { selectedOption: null } }));
    select.dispatchEvent(new CustomEvent('change', { detail: {} }));

    expect(onChange).not.toHaveBeenCalled();
    expect(select.value).toBe('user');
  });

  it('ignores a value outside of the role model', () => {
    const onChange = vi.fn();
    const select = createRoleSelect({ value: 'user', accessibleName: 'Роль', onChange });

    select.dispatchEvent(
      new CustomEvent('change', { detail: { selectedOption: { value: 'superuser' } } }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(select.value).toBe('user');
  });
});

describe('roleSelectCell', () => {
  it('hosts the select inside a table cell', () => {
    const select = createRoleSelect({ value: 'user', accessibleName: 'Роль', onChange: vi.fn() });

    const cell = roleSelectCell(select);

    expect(cell.tagName.toLowerCase()).toBe('ui5-table-cell');
    expect(cell.querySelector('ui5-select')).toBe(select as unknown as SelectElement);
  });
});
