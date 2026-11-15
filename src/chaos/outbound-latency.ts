export const PEER_LATENCY_HEADER = 'x-peer-latency-ms';
export const LATENCY_TARGET_PEER = 'biblio-express';
export const MAX_PEER_LATENCY_MS = 30_000;

export function parsePeerLatency(value: unknown): number {
  const ms = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(ms) || ms <= 0) {
    return 0;
  }
  return Math.min(Math.round(ms), MAX_PEER_LATENCY_MS);
}

export function peerLatencyMs(headerValue: unknown, envValue: unknown): number {
  const fromHeader = parsePeerLatency(headerValue);
  if (fromHeader > 0) return fromHeader;
  return parsePeerLatency(envValue);
}
