import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { get } from '@api/profile';
import { type MeResponse } from '@shared/model';

import { subscribeProfileUpdated } from '../model/profileSync';
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

/**
 * Профиль текущей сессии.
 *
 * Правка в соседней вкладке: слушает шину `profileSync` и перечитывает
 * профиль, чтобы аватар в шапке и карточка показали новую версию. В самой
 * вкладке, где сохраняют, этого не требуется — там форма после успеха
 * инвалидирует кеш общего синглтонного QueryClient.
 */
export function useProfileQuery() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeProfileUpdated(
        () => void queryClient.invalidateQueries({ queryKey: profileKeys.current }),
      ),
    [queryClient],
  );

  return useQuery({ queryKey: profileKeys.current, queryFn: fetchProfile });
}
