import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncTask<T> {
  /** Result of the most recent successful run. */
  data: T | undefined;
  loading: boolean;
  /** Reason of the most recent failure, `undefined` while the task succeeds. */
  error: unknown;
  /** Runs the task; the identity is stable, so it can be used as effect dependency. */
  run(): Promise<void>;
  /** Drops the result and the error without running the task. */
  reset(): void;
}

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
}

const IDLE: AsyncState<never> = { data: undefined, loading: false, error: undefined };

/**
 * Runs an asynchronous task and exposes its state to a component.
 *
 * Only the result of the most recent run is kept, so a slow reload can never
 * overwrite a newer one, and a failure keeps the data that is already on screen
 * - which is what the lists of the application need while they refresh.
 */
export function useAsyncTask<T>(task: () => Promise<T>): AsyncTask<T> {
  const taskRef = useRef(task);
  taskRef.current = task;

  /** Number of the most recent run; older results are discarded. */
  const currentRun = useRef(0);
  const mounted = useRef(true);
  const [state, setState] = useState<AsyncState<T>>(IDLE);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (): Promise<void> => {
    currentRun.current += 1;
    const run = currentRun.current;
    setState((previous) => ({ ...previous, loading: true }));

    try {
      const data = await taskRef.current();
      if (mounted.current && run === currentRun.current) {
        setState({ data, loading: false, error: undefined });
      }
    } catch (error) {
      if (mounted.current && run === currentRun.current) {
        setState((previous) => ({ data: previous.data, loading: false, error }));
      }
    }
  }, []);

  const reset = useCallback((): void => {
    currentRun.current += 1;
    setState(IDLE);
  }, []);

  return { ...state, run, reset };
}
