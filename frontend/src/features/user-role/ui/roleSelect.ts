import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Select.js';

import type Option from '@ui5/webcomponents/dist/Option.js';
import type Select from '@ui5/webcomponents/dist/Select.js';

import { ROLES, roleLabel, type Role } from '@/entities/user';
import { detailOf } from '@/shared/lib';

export interface RoleSelectOptions {
  value: Role;
  accessibleName: string;
  onChange(role: Role): void;
}

/** Dropdown that assigns one of the application roles to a user. */
export function createRoleSelect(options: RoleSelectOptions): Select {
  const select = document.createElement('ui5-select') as Select;
  select.accessibleName = options.accessibleName;

  ROLES.forEach((role) => {
    const option = document.createElement('ui5-option') as Option;
    option.value = role;
    option.textContent = roleLabel(role);
    select.appendChild(option);
  });

  select.value = options.value;
  select.addEventListener('change', (event) => {
    const { selectedOption } = detailOf<{ selectedOption: Option }>(event);
    const value = selectedOption?.value;
    if (value !== undefined && ROLES.includes(value as Role)) {
      select.value = value;
      options.onChange(value as Role);
    }
  });

  return select;
}

/** Cell that hosts the role dropdown of a table row. */
export function roleSelectCell(select: Select): HTMLElement {
  const cell = document.createElement('ui5-table-cell');
  cell.appendChild(select);
  return cell;
}
