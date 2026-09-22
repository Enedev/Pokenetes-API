import { describe, it, expect, vi } from 'vitest';
import { ConfiguredSqsQueue, MemoryQueue } from '../orchestrator/src/queue';
import { FlujoMessage } from '../orchestrator/src/types';

const message: FlujoMessage = {
  trace_id: 'trace-1',
  entity: 'pokemon',
  status: 'pending',
  steps: [],
  created_at: '2026-09-21T00:00:00.000Z',
  updated_at: '2026-09-21T00:00:00.000Z',
};

describe('ConfiguredSqsQueue', () => {
  it('uses the in-memory worker when the queue URL is empty', async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const queue = new ConfiguredSqsQueue('', new MemoryQueue(worker));
    await queue.enqueue(message);
    expect(worker).toHaveBeenCalledWith(message);
  });

  it('sends the flujo to SQS when a queue URL is configured', async () => {
    const worker = vi.fn();
    const send = vi.fn().mockResolvedValue({});
    const queue = new ConfiguredSqsQueue(
      'https://sqs.us-east-1.amazonaws.com/722500516562/pokenetes-flujo',
      new MemoryQueue(worker),
      { send },
    );

    await queue.enqueue(message);

    expect(worker).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
