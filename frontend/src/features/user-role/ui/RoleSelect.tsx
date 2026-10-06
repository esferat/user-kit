import { Option } from '@ui5/webcomponents-react/Option';
import { Select } from '@ui5/webcomponents-react/Select';

import { ROLES, roleLabel, type Role } from '@/entities/user';

export interface RoleSelectProps {
  value: Role;
  accessibleName: string;
  onChange(role: Role): void;
}

/** Выпадающий список, назначающий пользователю одну из ролей приложения. */
export function RoleSelect({ value, accessibleName, onChange }: RoleSelectProps) {
  return (
    <Select
      accessibleName={accessibleName}
      value={value}
      onChange={(event) => {
        const selected = event.detail.selectedOption.value as Role;
        if (selected !== value && ROLES.includes(selected)) {
          onChange(selected);
        }
      }}
    >
      {ROLES.map((role) => (
        <Option key={role} value={role}>
          {roleLabel(role)}
        </Option>
      ))}
    </Select>
  );
}
