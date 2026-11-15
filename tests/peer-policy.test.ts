import { describe, expect, it } from 'vitest';
import { CircuitBreaker, resilienceFrom, withDeadline } from '../src/chaos/peer-policy';

describe('peer policy', () => {
  it('reads the resilience switch from the header or the env', () => {
    expect(resilienceFrom('true', '0')).toBe(true);
    expect(resilienceFrom(undefined, '1')).toBe(true);
    expect(resilienceFrom(undefined, undefined)).toBe(false);
  });

  it('opens the breaker after three failures', () => {
    const breaker = new CircuitBreaker(3, 1_000);
    breaker.failure(0);
    breaker.failure(0);
    expect(breaker.allow(0)).toBe(true);
    breaker.failure(0);
    expect(breaker.allow(0)).toBe(false);
    expect(breaker.allow(1_000)).toBe(true);
  });

  it('returns timeout without waiting for the work', async () => {
    const raced = await withDeadline(() => new Promise(() => undefined), 20);
    expect(raced).toEqual({ ok: false, reason: 'timeout' });
  });
});
