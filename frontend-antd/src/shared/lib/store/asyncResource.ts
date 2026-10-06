import { makeAutoObservable, runInAction } from 'mobx';

/** Жизненный цикл одного запроса. */
export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Один запрос в виде observable-состояния.
 *
 * MobX владеет всем жизненным циклом, поэтому компонент лишь читает `data`, `loading` и
 * `error` и никогда не хранит собственный флаг загрузки. Сохраняется только результат
 * самого последнего запуска, поэтому медленная перезагрузка не может перезаписать более
 * новую, а при сбое остаются данные, уже выведенные на экран.
 */
export class AsyncResource<T> {
  status: ResourceStatus = 'idle';
  data: T | undefined = undefined;
  error: unknown = undefined;

  /** Номер самого последнего запуска; результаты старых запусков отбрасываются. */
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

  /** Запускает запрос и публикует его результат. */
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

  /** Сбрасывает результат и ошибку, не запуская запрос. */
  reset(): void {
    this.pending += 1;
    this.status = 'idle';
    this.data = undefined;
    this.error = undefined;
  }

  /** Публикует значение, пришедшее не из запроса, например локальное изменение. */
  publish(data: T): void {
    this.pending += 1;
    this.data = data;
    this.error = undefined;
    this.status = 'success';
  }
}
