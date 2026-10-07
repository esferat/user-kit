import { useDispatch, useSelector } from 'react-redux';

import type { TypedUseSelectorHook } from 'react-redux';

import type { AppDispatch, RootState } from './store';

/** Dispatch приложения, знает thunk из extra argument. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** Selector приложения, знает корневой state. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
