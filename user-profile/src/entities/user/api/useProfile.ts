import { useQuery } from '@tanstack/react-query';

import { get } from '@api/profile';
import { type MeResponse } from '@shared/model';

import { profileKeys } from './profileKeys';

/**
 * Читает профиль текущей сессии через BFF. BFF возвращает безопасный
 * результат, поэтому отказ не бросается как исключение, а превращается в
 * него здесь — так его поймает `error` запроса.
 */
export async function fetchProfile(): Promise<MeResponse> {
  const result = await get();
  if (result.data === null) {
    throw new Error(result.error);
  }
  return result.data;
}

/** Профиль текущей сессии. */
export function useProfileQuery() {
  return useQuery({ queryKey: profileKeys.current, queryFn: fetchProfile });
}
