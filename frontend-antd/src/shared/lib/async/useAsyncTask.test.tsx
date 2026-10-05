import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAsyncTask } from './useAsyncTask';

/** Renders the state of the hook and lets the test trigger runs. */
function Probe({ task }: { task: () => Promise<string> }) {
  const { data, error, loading, run, reset } = useAsyncTask(task);
  const [runs, setRuns] = useState(0);

  return (
    <div>
      <span data-testid="data">{data ?? '-'}</span>
      <span data-testid="error">{error instanceof Error ? error.message : '-'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="runs">{runs}</span>
      <button
        type="button"
        onClick={() => {
          void run();
          setRuns((value) => value + 1);
        }}
      >
        run
      </button>
      <button type="button" onClick={reset}>
        reset
      </button>
    </div>
  );
}

function click(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('useAsyncTask', () => {
  it('starts idle', () => {
    render(<Probe task={async () => 'value'} />);

    expect(screen.getByTestId('data').textContent).toBe('-');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('-');
  });

  it('exposes the result of the task', async () => {
    render(<Probe task={async () => 'value'} />);

    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('data').textContent).toBe('value'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('-');
  });

  it('marks the task as running while it is pending', async () => {
    const pending: { resolve?: (value: string) => void } = {};
    const task = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          pending.resolve = resolve;
        }),
    );
    render(<Probe task={task} />);

    click('run');
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await act(async () => {
      pending.resolve?.('value');
    });
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('data').textContent).toBe('value');
  });

  it('reports a failure of the task', async () => {
    render(
      <Probe
        task={async () => {
          throw new Error('backend is down');
        }}
      />,
    );

    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('error').textContent).toBe('backend is down'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('keeps the data on screen while a reload fails', async () => {
    let shouldFail = false;
    render(
      <Probe
        task={async () => {
          if (shouldFail) {
            throw new Error('backend is down');
          }
          return 'value';
        }}
      />,
    );
    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('data').textContent).toBe('value'));

    shouldFail = true;
    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('error').textContent).toBe('backend is down'));
    expect(screen.getByTestId('data').textContent).toBe('value');
  });

  it('forgets a failure after the next successful run', async () => {
    let shouldFail = true;
    render(
      <Probe
        task={async () => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error('backend is down');
          }
          return 'value';
        }}
      />,
    );

    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('error').textContent).toBe('backend is down'));

    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('data').textContent).toBe('value'));
    expect(screen.getByTestId('error').textContent).toBe('-');
  });

  it('discards the result of a superseded run', async () => {
    const pending: ((value: string) => void)[] = [];
    render(
      <Probe
        task={async () =>
          new Promise<string>((resolve) => {
            pending.push(resolve);
          })
        }
      />,
    );

    click('run');
    click('run');
    expect(screen.getByTestId('runs').textContent).toBe('2');

    await act(async () => {
      pending[1]?.('second');
    });
    expect(screen.getByTestId('data').textContent).toBe('second');

    await act(async () => {
      pending[0]?.('first');
    });
    expect(screen.getByTestId('data').textContent).toBe('second');
  });

  it('drops the result on reset', async () => {
    render(<Probe task={async () => 'value'} />);
    click('run');
    await vi.waitFor(() => expect(screen.getByTestId('data').textContent).toBe('value'));

    click('reset');

    expect(screen.getByTestId('data').textContent).toBe('-');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('keeps a stable identity of run and reset', async () => {
    const identities: unknown[] = [];
    const task = vi.fn(async () => 'value');

    function IdentityProbe() {
      const { run, reset } = useAsyncTask(task);
      identities.push([run, reset]);
      return null;
    }

    const { rerender } = render(<IdentityProbe />);
    rerender(<IdentityProbe />);

    expect(identities[0]).toEqual(identities[1]);
    expect(task).not.toHaveBeenCalled();
  });
});
