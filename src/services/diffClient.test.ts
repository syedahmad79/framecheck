import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DIFF_SETTINGS } from '@/domain/types';
import { DiffClient, type DiffJob, type DiffWorker } from './diffClient';
import type { DiffRequest, DiffResponse, DiffResult } from './diffProtocol';

class FakeWorker implements DiffWorker {
  onmessage: ((event: MessageEvent<DiffResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly requests: DiffRequest[] = [];
  terminated = false;

  postMessage(message: DiffRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: DiffResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<DiffResponse>);
  }

  crash(): void {
    this.onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent);
  }
}

const job: DiffJob = {
  sourceKey: 'pair-1',
  reference: new Blob(['a']),
  implementation: new Blob(['b']),
  settings: DEFAULT_DIFF_SETTINGS,
};

const result = { compareMs: 1 } as DiffResult;

function setup() {
  const workers: FakeWorker[] = [];
  const client = new DiffClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers };
}

describe('DiffClient', () => {
  it('creates the worker lazily and resolves with the matching result', async () => {
    const { client, workers } = setup();
    expect(workers).toHaveLength(0);

    const promise = client.run(job);
    const worker = workers[0];
    expect(worker?.requests).toHaveLength(1);

    worker?.respond({ type: 'result', jobId: worker.requests[0]?.jobId ?? -1, result });
    await expect(promise).resolves.toBe(result);
  });

  it('resolves a superseded job with null and ignores its late response', async () => {
    const { client, workers } = setup();
    const first = client.run(job);
    const second = client.run({ ...job, settings: { ...DEFAULT_DIFF_SETTINGS, threshold: 0.3 } });
    await expect(first).resolves.toBeNull();

    const worker = workers[0];
    const [firstRequest, secondRequest] = worker?.requests ?? [];
    expect(workers).toHaveLength(1);
    expect(secondRequest?.jobId).not.toBe(firstRequest?.jobId);

    const stale = { compareMs: 99 } as DiffResult;
    worker?.respond({ type: 'result', jobId: firstRequest?.jobId ?? -1, result: stale });
    worker?.respond({ type: 'result', jobId: secondRequest?.jobId ?? -1, result });
    await expect(second).resolves.toBe(result);
  });

  it('rejects with the worker-reported error message', async () => {
    const { client, workers } = setup();
    const promise = client.run(job);
    const worker = workers[0];
    worker?.respond({ type: 'error', jobId: worker.requests[0]?.jobId ?? -1, message: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('replaces a crashed worker on the next run', async () => {
    const { client, workers } = setup();
    const promise = client.run(job);
    workers[0]?.crash();
    await expect(promise).rejects.toThrow(/stopped unexpectedly/);
    expect(workers[0]?.terminated).toBe(true);

    void client.run(job);
    expect(workers).toHaveLength(2);
  });

  it('dispose terminates the worker and settles the running job', async () => {
    const { client, workers } = setup();
    const promise = client.run(job);
    client.dispose();
    await expect(promise).resolves.toBeNull();
    expect(workers[0]?.terminated).toBe(true);
  });
});
