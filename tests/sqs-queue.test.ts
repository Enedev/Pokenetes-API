import { describe, it, expect, vi } from 'vitest';
import { ConfiguredSqsQueue, isReprocessed, MemoryQueue, readPendingCount } from '../orchestrator/src/queue';
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

describe('queue metrics', () => {
  it('counts a message as reprocessed only after the first delivery', () => {
    expect(isReprocessed('1')).toBe(false);
    expect(isReprocessed(undefined)).toBe(false);
    expect(isReprocessed('2')).toBe(true);
  });

  it('reads pending messages from the queue attributes', async () => {
    const send = vi.fn().mockResolvedValue({
      Attributes: { ApproximateNumberOfMessages: '4' },
    });

    await expect(readPendingCount(
      'https://sqs.us-east-1.amazonaws.com/722500516562/pokenetes-flujo',
      { send },
    )).resolves.toBe(4);
  });
});
