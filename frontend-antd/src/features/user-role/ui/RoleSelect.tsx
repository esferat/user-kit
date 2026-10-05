import { Select } from 'antd';

import { ROLES, roleLabel, type Role } from '@/entities/user';

export interface RoleSelectProps {
  value: Role;
  accessibleName: string;
  onChange(role: Role): void;
}

/** Dropdown that assigns one of the application roles to a user. */
export function RoleSelect({ value, accessibleName, onChange }: RoleSelectProps) {
  return (
    <Select<Role>
      aria-label={accessibleName}
      value={value}
      options={ROLES.map((role) => ({ label: roleLabel(role), value: role }))}
      onChange={(selected) => {
        if (selected !== value && ROLES.includes(selected)) {
          onChange(selected);
        }
      }}
    />
  );
}
