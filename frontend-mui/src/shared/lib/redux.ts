import type { AnyAction, ThunkDispatch } from '@reduxjs/toolkit';

/**
 * Тип dispatch для компонентов вне `app`-слоя: принимает и синхронные действия
 * слайса, и thunk из `createAsyncThunk`. Типизированные в `app` стороны (где
 * известен корневой state) использовать нельзя, потому что слои не могут
 * импортировать `@/app`; здесь подпись раскрыта до `unknown`, что безопасно,
 * ведь настоящие thunk сами кастуют extra к нужным сервисам.
 */
export type AppDispatch = ThunkDispatch<unknown, unknown, AnyAction>;
