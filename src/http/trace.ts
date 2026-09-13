import { randomUUID } from 'crypto';

export function resolveTraceId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return randomUUID();
}
