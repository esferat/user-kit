import { autorun, runInAction } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import { AsyncResource } from './asyncResource';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(reason: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe('AsyncResource', () => {
  it('starts idle without a result', () => {
    const resource = new AsyncResource(async () => 'value');

    expect(resource.status).toBe('idle');
    expect(resource.data).toBeUndefined();
    expect(resource.error).toBeUndefined();
    expect(resource.loading).toBe(false);
    expect(resource.failed).toBe(false);
  });

  it('publishes the result of the task', async () => {
    const resource = new AsyncResource(async () => 'value');

    await resource.fetch();

    expect(resource.status).toBe('success');
    expect(resource.succeeded).toBe(true);
    expect(resource.data).toBe('value');
    expect(resource.loading).toBe(false);
  });

  it('is loading while the task runs', async () => {
    const task = deferred<string>();
    const resource = new AsyncResource(() => task.promise);

    const running = resource.fetch();
    expect(resource.status).toBe('loading');
    expect(resource.loading).toBe(true);

    task.resolve('value');
    await running;

    expect(resource.loading).toBe(false);
  });

  it('keeps the reason of a failed task', async () => {
    const resource = new AsyncResource(async () => {
      throw new Error('backend is down');
    });

    await resource.fetch();

    expect(resource.status).toBe('error');
    expect(resource.failed).toBe(true);
    expect((resource.error as Error).message).toBe('backend is down');
  });

  it('keeps the data on screen when a reload fails', async () => {
    let calls = 0;
    const resource = new AsyncResource(async () => {
      calls += 1;
      if (calls > 1) {
        throw new Error('backend is down');
      }
      return 'value';
    });

    await resource.fetch();
    await resource.fetch();

    expect(resource.data).toBe('value');
    expect(resource.status).toBe('error');
  });

  it('discards the result of a run that is no longer the most recent one', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const results = [slow.promise, fast.promise];
    const resource = new AsyncResource(() => results.shift() ?? Promise.resolve('extra'));

    const first = resource.fetch();
    const second = resource.fetch();

    fast.resolve('newer');
    await second;
    slow.resolve('older');
    await first;

    expect(resource.data).toBe('newer');
  });

  it('drops the result and the error on reset', async () => {
    const resource = new AsyncResource(async () => 'value');
    await resource.fetch();

    resource.reset();

    expect(resource.status).toBe('idle');
    expect(resource.data).toBeUndefined();
    expect(resource.error).toBeUndefined();
  });

  it('publishes a value that did not come from the task', async () => {
    const task = vi.fn(async () => 'from task');
    const resource = new AsyncResource(task);

    resource.publish('local');

    expect(resource.data).toBe('local');
    expect(resource.status).toBe('success');
    expect(task).not.toHaveBeenCalled();
  });

  it('reports every change to an observer', async () => {
    const resource = new AsyncResource(async () => 'value');
    const seen: string[] = [];
    const stop = autorun(() => {
      seen.push(resource.status);
    });

    await resource.fetch();
    stop();

    expect(seen).toEqual(['idle', 'loading', 'success']);
  });

  it('lets an observer run outside of an action', () => {
    const resource = new AsyncResource(async () => 'value');

    expect(() => {
      runInAction(() => {
        resource.status = 'error';
      });
    }).not.toThrow();
  });
});
