export interface ResiliencePolicy {
  enabled: boolean;
  timeoutMs: number;
  breakerFailures: number;
  breakerOpenMs: number;
}

export function resilienceFrom(headerValue: unknown, envValue: unknown): boolean {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof header === 'string' && header.trim().toLowerCase() === 'true') return true;
  return String(envValue ?? '').trim() === '1';
}

export function policyFrom(enabled: boolean): ResiliencePolicy {
  return {
    enabled,
    timeoutMs: 300,
    breakerFailures: 3,
    breakerOpenMs: 15_000,
  };
}

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold: number,
    private readonly openMs: number,
  ) {}

  allow(now: number): boolean {
    return now >= this.openUntil;
  }

  success(): void {
    this.failures = 0;
  }

  failure(now: number): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = now + this.openMs;
      this.failures = 0;
    }
  }
}

export async function withDeadline<T>(
  work: () => Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | { ok: false; reason: 'timeout' }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ ok: false; reason: 'timeout' }>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs);
  });

  try {
    return await Promise.race([
      work().then((value) => ({ ok: true as const, value })),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
