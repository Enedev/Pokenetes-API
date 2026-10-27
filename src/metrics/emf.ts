import type { Track } from '../config/release';
import { APP_VERSION } from '../config/version';

export const EMF_NAMESPACE = 'Pokenetes/Canary';

export type EmfUnit = 'Milliseconds' | 'Count' | 'Megabytes' | 'Percent';

export type EmfMetrics = Record<string, { value: number; unit: EmfUnit }>;

type Sink = (line: string) => void;

let enabled = process.env.METRICS_EMF === 'true';
let sink: Sink = (line) => process.stdout.write(`${line}\n`);

export function configureEmf(options: { enabled?: boolean; sink?: Sink }): void {
  if (options.enabled !== undefined) enabled = options.enabled;
  if (options.sink) sink = options.sink;
}

export function emfLine(
  track: Track,
  metrics: EmfMetrics,
  properties: Record<string, string | number> = {},
  timestamp = Date.now(),
): string {
  const values: Record<string, number> = {};
  for (const [name, metric] of Object.entries(metrics)) values[name] = metric.value;

  return JSON.stringify({
    _aws: {
      Timestamp: timestamp,
      CloudWatchMetrics: [
        {
          Namespace: EMF_NAMESPACE,
          Dimensions: [['Track']],
          Metrics: Object.entries(metrics).map(([name, metric]) => ({ Name: name, Unit: metric.unit })),
        },
      ],
    },
    Track: track,
    Version: APP_VERSION,
    ...properties,
    ...values,
  });
}

export function emitMetrics(
  track: Track,
  metrics: EmfMetrics,
  properties?: Record<string, string | number>,
): void {
  if (!enabled) return;
  sink(emfLine(track, metrics, properties));
}
