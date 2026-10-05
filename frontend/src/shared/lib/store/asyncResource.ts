import { makeAutoObservable, runInAction } from 'mobx';

/** Lifecycle of a single request. */
export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * One request as observable state.
 *
 * MobX owns the whole lifecycle, so a component only reads `data`, `loading` and
 * `error` and never has to keep a loading flag of its own. Only the result of
 * the most recent run is kept, so a slow reload can never overwrite a newer one,
 * and a failure keeps the data that is already on screen.
 */
export class AsyncResource<T> {
  status: ResourceStatus = 'idle';
  data: T | undefined = undefined;
  error: unknown = undefined;

  /** Number of the most recent run; results of older runs are discarded. */
  private pending = 0;

  private readonly task: () => Promise<T>;

  constructor(task: () => Promise<T>) {
    this.task = task;
    makeAutoObservable<AsyncResource<T>, 'task' | 'pending'>(this, { task: false, pending: false }, { autoBind: true });
  }

  get loading(): boolean {
    return this.status === 'loading';
  }

  get failed(): boolean {
    return this.status === 'error';
  }

  get succeeded(): boolean {
    return this.status === 'success';
  }

  /** Runs the request and publishes its result. */
  async fetch(): Promise<void> {
    this.pending += 1;
    const run = this.pending;
    this.status = 'loading';
    this.error = undefined;

    try {
      const data = await this.task();
      runInAction(() => {
        if (run !== this.pending) {
          return;
        }
        this.data = data;
        this.status = 'success';
      });
    } catch (error) {
      runInAction(() => {
        if (run !== this.pending) {
          return;
        }
        this.error = error;
        this.status = 'error';
      });
    }
  }

  /** Drops the result and the error without running the request. */
  reset(): void {
    this.pending += 1;
    this.status = 'idle';
    this.data = undefined;
    this.error = undefined;
  }

  /** Publishes a value that did not come from the request, e.g. a local edit. */
  publish(data: T): void {
    this.pending += 1;
    this.data = data;
    this.error = undefined;
    this.status = 'success';
  }
}
