export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

export function summarize(samples) {
  const latencies = samples.map((sample) => sample.ms);
  const errors5xx = samples.filter((sample) => sample.status >= 500 || sample.status === 0).length;
  const errors4xx = samples.filter((sample) => sample.status >= 400 && sample.status < 500).length;
  const n = samples.length;

  return {
    n,
    errors5xx,
    errors4xx,
    error_rate_pct: n === 0 ? 0 : (100 * errors5xx) / n,
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    p99_ms: percentile(latencies, 99),
  };
}

// Acklam's rational approximation of the standard normal quantile.
export function normalQuantile(p) {
  if (p <= 0 || p >= 1) throw new Error('p must be in (0, 1)');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);

  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? 1 - tail : tail;
}

export function requiredSampleSize(baselineRate, detectableRate, alpha = 0.05, power = 0.8) {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const pooled = (baselineRate + detectableRate) / 2;
  const numerator =
    zAlpha * Math.sqrt(2 * pooled * (1 - pooled)) +
    zBeta * Math.sqrt(baselineRate * (1 - baselineRate) + detectableRate * (1 - detectableRate));
  return Math.ceil(numerator ** 2 / (detectableRate - baselineRate) ** 2);
}

export function twoProportionTest(canaryErrors, canaryN, baselineErrors, baselineN) {
  if (canaryN === 0 || baselineN === 0) return { z: 0, p_value: 1 };
  const p1 = canaryErrors / canaryN;
  const p2 = baselineErrors / baselineN;
  const pooled = (canaryErrors + baselineErrors) / (canaryN + baselineN);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / canaryN + 1 / baselineN));
  if (se === 0) return { z: 0, p_value: 1 };
  const z = (p1 - p2) / se;
  return { z, p_value: 1 - normalCdf(z) };
}

function level(value, threshold) {
  if (value === null || value === undefined) return 'promote';
  if (value > threshold.abort_above) return 'abort';
  if (value > threshold.pause_max) return 'pause';
  if (value > threshold.promote_max) return 'pause';
  return 'promote';
}

const RANK = { promote: 0, pause: 1, abort: 2 };

export function decide(slo, canary, baseline) {
  const t = slo.thresholds;
  const checks = [
    { sli: 'error_rate_pct', value: canary.error_rate_pct, verdict: level(canary.error_rate_pct, t.error_rate_pct) },
    { sli: 'latency_p95_ms', value: canary.p95_ms, verdict: level(canary.p95_ms, t.latency_p95_ms) },
    { sli: 'latency_p99_ms', value: canary.p99_ms, verdict: level(canary.p99_ms, t.latency_p99_ms) },
  ];

  if (baseline && baseline.n > 0 && baseline.p95_ms) {
    const ratio = canary.p95_ms / Math.max(baseline.p95_ms, t.p95_vs_baseline_ratio.floor_ms ?? 1);
    checks.push({ sli: 'p95_vs_baseline_ratio', value: ratio, verdict: level(ratio, t.p95_vs_baseline_ratio) });
  }

  const test = baseline
    ? twoProportionTest(canary.errors5xx, canary.n, baseline.errors5xx, baseline.n)
    : { z: 0, p_value: 1 };
  const significant = test.p_value < slo.comparison.alpha;
  if (significant && canary.error_rate_pct > t.error_rate_pct.promote_max) {
    checks.push({ sli: 'error_rate_vs_baseline', value: test.z, verdict: 'abort' });
  }

  const enough = canary.n >= slo.comparison.min_samples_per_track;
  let decision = checks.reduce((worst, check) => (RANK[check.verdict] > RANK[worst] ? check.verdict : worst), 'promote');
  if (decision === 'promote' && !enough) decision = 'pause';

  return {
    decision,
    enough_samples: enough,
    min_samples: slo.comparison.min_samples_per_track,
    z: test.z,
    p_value: test.p_value,
    checks,
  };
}
