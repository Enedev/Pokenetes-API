import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { context, metrics, propagation, ROOT_CONTEXT, type Counter } from '@opentelemetry/api';
import { OrchestratorEnv } from './config/env';
import { runSaga } from './saga';
import { FetchLike, FlujoMessage } from './types';

export interface FlujoQueue {
  enqueue(message: FlujoMessage): Promise<void>;
}

export type SqsSendLike = {
  send(command: unknown): Promise<unknown>;
};

let reprocessed: Counter | undefined;

export function isReprocessed(receiveCount: string | undefined): boolean {
  return Number(receiveCount ?? '1') > 1;
}

export async function readPendingCount(queueUrl: string, client: SqsSendLike): Promise<number> {
  try {
    const response = (await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages'],
      }),
    )) as { Attributes?: Record<string, string> };
    return Number(response.Attributes?.ApproximateNumberOfMessages ?? 0);
  } catch {
    return 0;
  }
}

export function noteDelivery(receiveCount: string | undefined): void {
  if (!isReprocessed(receiveCount)) return;
  if (!reprocessed) {
    reprocessed = metrics.getMeter('pokenetes-orchestrator').createCounter('queue.messages.reprocessed', {
      description: 'Messages received again after a failed attempt',
    });
  }
  reprocessed.add(1);
}

export function bindPendingGauge(queueUrl: string, client: SqsSendLike): void {
  const gauge = metrics.getMeter('pokenetes-orchestrator').createObservableGauge('queue.messages.pending', {
    description: 'Messages waiting in the queue',
  });
  gauge.addCallback(async (result) => {
    result.observe(await readPendingCount(queueUrl, client));
  });
}

export class MemoryQueue implements FlujoQueue {
  constructor(private readonly worker: (message: FlujoMessage) => Promise<void>) {}

  async enqueue(message: FlujoMessage): Promise<void> {
    await this.worker(message);
  }
}

export class ConfiguredSqsQueue implements FlujoQueue {
  constructor(
    private readonly queueUrl: string,
    private readonly fallback: FlujoQueue,
    private readonly client: SqsSendLike = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    }),
  ) {}

  async enqueue(message: FlujoMessage): Promise<void> {
    if (!this.queueUrl) {
      await this.fallback.enqueue(message);
      return;
    }

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}

export function startSqsWorker(options: {
  queueUrl: string;
  env: OrchestratorEnv;
  fetchImpl: FetchLike;
  client?: SqsSendLike;
}): () => void {
  const client =
    options.client ??
    new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  bindPendingGauge(options.queueUrl, client);
  let running = true;

  const loop = async () => {
    while (running) {
      try {
        const received = (await client.send(
          new ReceiveMessageCommand({
            QueueUrl: options.queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
          }),
        )) as { Messages?: Array<{ Body?: string; ReceiptHandle?: string; Attributes?: Record<string, string> }> };

        for (const message of received.Messages ?? []) {
          if (!message.Body || !message.ReceiptHandle) {
            continue;
          }

          noteDelivery(message.Attributes?.ApproximateReceiveCount);
          const payload = JSON.parse(message.Body) as FlujoMessage;
          const extracted = propagation.extract(ROOT_CONTEXT, { traceparent: payload.traceparent });
          await context.with(extracted, () => runSaga(payload, options.env, options.fetchImpl));
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: options.queueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );
        }
      } catch (error) {
        if (!running) {
          return;
        }
        console.error('SQS worker error:', error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  void loop();
  return () => {
    running = false;
  };
}
