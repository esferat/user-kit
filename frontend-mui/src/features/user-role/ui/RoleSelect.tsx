import { MenuItem, TextField } from '@mui/material';

import { ROLES, roleLabel, type Role } from '@/entities/user';

export interface RoleSelectProps {
  value: Role;
  accessibleName: string;
  onChange(role: Role): void;
}

/** Выпадающий список, назначающий пользователю одну из ролей приложения. */
export function RoleSelect({ value, accessibleName, onChange }: RoleSelectProps) {
  return (
    <TextField
      select
      inputProps={{ 'aria-label': accessibleName }}
      size="small"
      value={value}
      onChange={(event) => {
        const selected = event.target.value as Role;
        if (selected !== value && ROLES.includes(selected)) {
          onChange(selected);
        }
      }}
      sx={{ minWidth: '8.75rem' }}
    >
      {ROLES.map((role) => (
        <MenuItem key={role} value={role}>
          {roleLabel(role)}
        </MenuItem>
      ))}
    </TextField>
  );
}
