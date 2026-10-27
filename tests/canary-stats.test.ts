import { describe, it, expect } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { decide, normalQuantile, percentile, requiredSampleSize, summarize, twoProportionTest } from '../scripts/canary/stats.mjs';
// @ts-expect-error plain ESM script without type declarations
import { groupByTrack, pickWeighted } from '../scripts/canary/load.mjs';
// @ts-expect-error plain ESM script without type declarations
import { alignWindow, metricQueries, toTrackSummary } from '../scripts/canary/analyze.mjs';
import slo from '../canary/slo.json';
import stages from '../canary/stages.json';

const healthy = { n: 1000, errors5xx: 2, errors4xx: 0, error_rate_pct: 0.2, p50_ms: 40, p95_ms: 120, p99_ms: 300 };

describe('percentile and summarize', () => {
  it('uses the nearest-rank percentile', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(percentile([], 95)).toBeNull();
  });

  it('counts timeouts as 5xx', () => {
    const summary = summarize([
      { status: 200, ms: 10 },
      { status: 503, ms: 20 },
      { status: 0, ms: 10000 },
      { status: 404, ms: 5 },
    ]);
    expect(summary).toMatchObject({ n: 4, errors5xx: 2, errors4xx: 1, error_rate_pct: 50 });
  });
});

describe('sample size', () => {
  it('matches the textbook normal quantiles', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 2);
    expect(normalQuantile(0.8)).toBeCloseTo(0.8416, 3);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.3263, 3);
  });

  it('needs about 284 requests per track to tell 1% from 5% errors', () => {
    const n = requiredSampleSize(slo.comparison.baseline_error_rate, slo.comparison.detectable_error_rate);
    expect(n).toBeGreaterThanOrEqual(280);
    expect(n).toBeLessThanOrEqual(290);
    expect(slo.comparison.min_samples_per_track).toBeGreaterThanOrEqual(n);
  });
});

describe('two-proportion test', () => {
  it('flags a real difference and ignores noise', () => {
    expect(twoProportionTest(30, 300, 3, 300).p_value).toBeLessThan(0.05);
    expect(twoProportionTest(4, 300, 3, 300).p_value).toBeGreaterThan(0.05);
    expect(twoProportionTest(0, 0, 0, 10)).toEqual({ z: 0, p_value: 1 });
  });
});

describe('decide', () => {
  it('promotes a healthy canary with enough samples', () => {
    expect(decide(slo, healthy, healthy).decision).toBe('promote');
  });

  it('pauses while the sample is too small', () => {
    expect(decide(slo, { ...healthy, n: 50 }, healthy).decision).toBe('pause');
  });

  it('pauses between promote and abort thresholds', () => {
    expect(decide(slo, { ...healthy, p95_ms: 700 }, { ...healthy, p95_ms: 600 }).decision).toBe('pause');
  });

  it('aborts on a high error rate', () => {
    const broken = { ...healthy, errors5xx: 300, error_rate_pct: 30 };
    const verdict = decide(slo, broken, healthy);
    expect(verdict.decision).toBe('abort');
    expect(verdict.checks.map((check: { sli: string }) => check.sli)).toContain('error_rate_vs_baseline');
  });

  it('aborts when p95 is far worse than the baseline', () => {
    expect(decide(slo, { ...healthy, p95_ms: 400 }, { ...healthy, p95_ms: 100 }).decision).toBe('abort');
  });

  it('ignores p95 ratios when both tracks are under the floor', () => {
    const fast = { ...healthy, p95_ms: 12 };
    expect(decide(slo, { ...fast, p95_ms: 30 }, fast).decision).toBe('promote');
  });

  it('works without a baseline at 100%', () => {
    expect(decide(slo, healthy, { n: 0, errors5xx: 0, p95_ms: null }).decision).toBe('promote');
  });
});

describe('load helpers', () => {
  it('picks by weight', () => {
    const mix = [
      { weight: 1, path: '/a' },
      { weight: 3, path: '/b' },
    ];
    expect(pickWeighted(mix, () => 0.1).path).toBe('/a');
    expect(pickWeighted(mix, () => 0.9).path).toBe('/b');
  });

  it('groups samples by the X-App-Track header', () => {
    const byTrack = groupByTrack([
      { track: 'stable', status: 200, ms: 10 },
      { track: 'canary', status: 500, ms: 20 },
    ]);
    expect(byTrack.stable.n).toBe(1);
    expect(byTrack.canary.errors5xx).toBe(1);
  });
});

describe('cloudwatch analysis', () => {
  it('queries every stat for both target groups', () => {
    const queries = metricQueries('app/lb/1', { stable: 'tg/s/1', canary: 'tg/c/2' }, 300);
    expect(queries).toHaveLength(12);
    expect(queries[0].MetricStat.Metric.Dimensions[1].Value).toBe('tg/s/1');
  });

  it('keeps only whole minutes inside the bake', () => {
    const at = (minute: number, second = 0) => Date.UTC(2026, 9, 27, 17, minute, second);
    const window = alignWindow(at(26, 50), at(29, 50));
    expect(window.start.toISOString()).toBe('2026-10-27T17:27:00.000Z');
    expect(window.end.toISOString()).toBe('2026-10-27T17:29:00.000Z');
    expect(window.period).toBe(120);
    expect(alignWindow(at(26, 10), at(26, 40)).period).toBe(60);
  });

  it('turns seconds into milliseconds and rates', () => {
    const summary = toTrackSummary(
      [
        { Id: 'canary_requests', Values: [200] },
        { Id: 'canary_errors5xx', Values: [10] },
        { Id: 'canary_p95', Values: [0.25] },
      ],
      'canary',
    );
    expect(summary).toMatchObject({ n: 200, error_rate_pct: 5, p95_ms: 250, p50_ms: null });
  });
});

describe('versioned canary config', () => {
  it('walks 0, 10, 50 and 100 with a bake time on each stage', () => {
    expect(stages.stages.map((stage) => stage.weight)).toEqual([0, 10, 50, 100]);
    expect(stages.stages.every((stage) => stage.bake_seconds >= 60)).toBe(true);
  });

  it('orders every threshold promote <= pause < abort', () => {
    for (const threshold of Object.values(slo.thresholds)) {
      expect(threshold.promote_max).toBeLessThanOrEqual(threshold.pause_max);
      expect(threshold.pause_max).toBeLessThan(threshold.abort_above);
    }
  });
});
