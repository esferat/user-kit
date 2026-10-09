import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Role, UserApi, UserDto, UserListQuery } from '@/entities/user';
import type { PageResponse } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { roleLabel } from '@/entities/user';
import { t } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';

const LIST_QUERY: UserListQuery = { sort: 'email', size: 100 };

export interface UsersState {
  users: readonly UserDto[];
  loading: boolean;
  error: unknown;
  message: AppMessage | undefined;
}

const initialState: UsersState = {
  users: [],
  loading: false,
  error: undefined,
  message: undefined,
};

interface UsersServices {
  services: { userApi: UserApi };
}

function failedMessage(error: unknown): string {
  return messageOfError(error, t('common.unknownError'));
}

/** Загружает всех пользователей backend в порядке email. */
export const listUsers = createAsyncThunk<PageResponse<UserDto>, void, { rejectValue: string }>(
  'users/list',
  async (_arg, thunkAPI) => {
    const { services } = thunkAPI.extra as UsersServices;
    try {
      return await services.userApi.list(LIST_QUERY);
    } catch (error) {
      return thunkAPI.rejectWithValue(failedMessage(error));
    }
  },
);

/** Перезагружает список и заодно очищает сообщение о прошлом действии. */
export const refreshUsers = createAsyncThunk<void, void>('users/refresh', async (_arg, thunkAPI) => {
  thunkAPI.dispatch(usersSlice.actions.clearMessage());
  await thunkAPI.dispatch(listUsers());
});

export interface RoleChangeRequest {
  user: UserDto;
  role: Role;
}

/**
 * Назначает одну роль и перезагружает список, чтобы таблица показывала то,
 * что принял backend. Отклонённое изменение тоже перезагружается: сохранённые
 * роли тогда совпадают с теми, что на экране.
 */
export const updateUserRole = createAsyncThunk<void, RoleChangeRequest, { rejectValue: string }>(
  'users/updateRole',
  async ({ user, role }, thunkAPI) => {
    const { services } = thunkAPI.extra as UsersServices;
    try {
      await services.userApi.updateRoles(user.id, [role]);
      thunkAPI.dispatch(
        usersSlice.actions.messageShown({
          text: t('users.message.roleUpdated', { email: user.email, role: roleLabel(role) }),
          design: 'Success',
        }),
      );
    } catch (error) {
      thunkAPI.dispatch(usersSlice.actions.messageShown({ text: failedMessage(error), design: 'Error' }));
    }
    await thunkAPI.dispatch(listUsers());
  },
);

export const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearMessage(state) {
      state.message = undefined;
    },
    messageShown(state, action: PayloadAction<AppMessage>) {
      state.message = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(listUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.error = undefined;
        state.users = action.payload.items;
      })
      .addCase(listUsers.rejected, (state, action) => {
        const text = action.payload ?? t('common.unknownError');
        state.loading = false;
        state.error = new Error(text);
        state.message = { text, design: 'Error' };
      });
  },
});

export const usersReducer = usersSlice.reducer;

export function selectUsers(state: { users: UsersState }): UsersState {
  return state.users;
}
