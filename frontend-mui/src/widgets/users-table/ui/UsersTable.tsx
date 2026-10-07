import {
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Box,
  Typography,
} from '@mui/material';

import type { Role, UserDto } from '@/entities/user';

import { RoleSelect } from '@/features/user-role';
import { useTranslate } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';

export interface UsersTableProps {
  users: readonly UserDto[];
  loading: boolean;
  onRoleChange(user: UserDto, role: Role): void;
}

/** Таблица страницы администрирования с назначением ролей прямо в строке. */
export function UsersTable({ users, loading, onRoleChange }: UsersTableProps) {
  const t = useTranslate();

  return (
    <Box sx={{ position: 'relative' }}>
      <TableContainer>
        <Table aria-label={t('users.table.label')} sx={{ minWidth: 'max-content' }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('users.column.email')}</TableCell>
              <TableCell>{t('users.column.name')}</TableCell>
              <TableCell sx={{ width: '12.5rem' }}>{t('users.column.role')}</TableCell>
              <TableCell sx={{ width: '7.5rem' }}>{t('users.column.enabled')}</TableCell>
              <TableCell>{t('users.column.updated')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary">{t('users.table.empty')}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover className="table-row">
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>
                    <RoleSelect
                      value={user.roles.includes('admin') ? 'admin' : 'user'}
                      accessibleName={t('users.row.roleLabel', { email: user.email })}
                      onChange={(role) => {
                        onRoleChange(user, role);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.enabled}
                      disabled
                      slotProps={{ input: { 'aria-label': t('users.row.enabledLabel', { email: user.email }) } }}
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(user.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && <LinearProgress className="table-loading" sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
    </Box>
  );
}
