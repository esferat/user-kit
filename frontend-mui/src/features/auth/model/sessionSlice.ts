import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthMode, AuthProvider, LoginOptions } from './types';

import type { AuthenticatedUser, Role } from '@/entities/user';

import { t } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';

/** Состояние сессии текущего пользователя. */
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface SessionState {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  /** Причина неудачного восстановления сессии, показывается на экране входа. */
  error: unknown;
  /** Причина неудачного входа или недоступного бэкенда, показывается сообщением. */
  failure: string | undefined;
  /** Вход выполняется: либо у провайдера, либо в dev-сессию. */
  pending: boolean;
  /** Какой вход предлагает бэкенд, `null`, пока он не ответил. */
  loginMode: AuthMode | null;
  /** Методы входа загружаются: экран входа может адаптироваться только после ответа. */
  modeLoading: boolean;
  /** Восстановление выполняется, поэтому результат ещё неизвестен. */
  restoring: boolean;
  /** Восстановление завершено; только теперь переданный пользователь становится текущим. */
  restored: boolean;
  /** Восстановление уже запрошено; оно не повторяется повторными запусками. */
  startRequested: boolean;
  /** Методы входа уже запрошены; они не меняются, пока жива страница. */
  modeRequested: boolean;
}

const initialState: SessionState = {
  user: null,
  status: 'restoring',
  error: undefined,
  failure: undefined,
  pending: false,
  loginMode: null,
  modeLoading: false,
  restoring: false,
  restored: false,
  startRequested: false,
  modeRequested: false,
};

interface SessionServices {
  services: { auth: AuthProvider };
}

function applyUser(state: SessionState, user: AuthenticatedUser | null): void {
  state.user = user;
  state.status = user === null ? 'anonymous' : 'authenticated';
  state.error = undefined;
}

/**
 * Восстанавливает сессию один раз на приложение. Двойное монтирование дерева
 * в `StrictMode` отсекается флагом `startRequested`, поэтому второго запроса
 * к backend не происходит.
 */
export const restoreSession = createAsyncThunk<AuthenticatedUser | null, void>(
  'session/restore',
  async (_arg, thunkAPI) => {
    const { services } = thunkAPI.extra as SessionServices;
    return services.auth.restore();
  },
  {
    condition: (_arg, { getState }) => {
      const state = (getState() as { session: SessionState }).session;
      return !state.startRequested;
    },
  },
);

/** Читает методы входа, которые предлагает бэкенд. */
export const loadLoginMode = createAsyncThunk<AuthMode, void, { rejectValue: string }>(
  'session/loadMode',
  async (_arg, thunkAPI) => {
    const { services } = thunkAPI.extra as SessionServices;
    try {
      return await services.auth.mode();
    } catch (error) {
      return thunkAPI.rejectWithValue(messageOfError(error, t('login.failed')));
    }
  },
  {
    condition: (_arg, { getState }) => {
      const state = (getState() as { session: SessionState }).session;
      return !state.modeRequested;
    },
  },
);

export interface LoginRequest {
  returnUrl?: string;
  role?: Role;
}

/**
 * Выполняет вход пользователя. С провайдером браузер к этому моменту уже
 * ушёл со страницы и promise здесь не завершится; локальный dev-вход
 * аутентифицирует на месте, поэтому после него сессия восстанавливается снова.
 */
export const login = createAsyncThunk<AuthenticatedUser | null, LoginRequest, { rejectValue: string }>(
  'session/login',
  async (request, thunkAPI) => {
    const { services } = thunkAPI.extra as SessionServices;
    const options: LoginOptions =
      request.role === undefined
        ? { returnUrl: request.returnUrl }
        : { returnUrl: request.returnUrl, role: request.role };
    try {
      await services.auth.login(options);
      return await services.auth.restore();
    } catch (error) {
      return thunkAPI.rejectWithValue(messageOfError(error, t('login.failed')));
    }
  },
);

/** Завершает сессию; сам пользователь обнуляется уведомлением провайдера. */
export const logout = createAsyncThunk<void, void>('session/logout', async (_arg, thunkAPI) => {
  const { services } = thunkAPI.extra as SessionServices;
  try {
    await services.auth.logout();
  } catch (error) {
    // Бэкенд очищает cookie ещё до ответа, поэтому при неудачном редиректе
    // восстанавливать нечего: сессия сохраняет то, что сообщил провайдер,
    // а причина годится лишь для консоли.
    console.error('logout failed', error);
  }
});

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /**
     * Пользователь, о котором сообщил провайдер (dev-вход, выход). Применяется
     * только после того, как восстановление сессии завершилось, чтобы запрос
     * `restore` не был перебит более старым состоянием провайдера.
     */
    userNotified(state, action: PayloadAction<AuthenticatedUser | null>) {
      if (state.restored) {
        applyUser(state, action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.startRequested = true;
        state.restoring = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restoring = false;
        state.restored = true;
        applyUser(state, action.payload);
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.restoring = false;
        state.restored = true;
        state.user = null;
        state.status = 'anonymous';
        state.error = new Error(action.error.message ?? String(action.error));
      })
      .addCase(loadLoginMode.pending, (state) => {
        state.modeRequested = true;
        state.modeLoading = true;
      })
      .addCase(loadLoginMode.fulfilled, (state, action) => {
        state.modeLoading = false;
        state.loginMode = action.payload;
      })
      .addCase(loadLoginMode.rejected, (state, action) => {
        state.modeLoading = false;
        state.loginMode = null;
        state.failure = action.payload ?? t('login.failed');
      })
      .addCase(login.pending, (state) => {
        state.pending = true;
        state.failure = undefined;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.restored = true;
        state.pending = false;
        applyUser(state, action.payload);
      })
      .addCase(login.rejected, (state, action) => {
        state.pending = false;
        state.failure = action.payload ?? t('login.failed');
      });
  },
});

export const { userNotified } = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

export function selectSession(state: { session: SessionState }): SessionState {
  return state.session;
}
