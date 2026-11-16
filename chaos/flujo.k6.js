import exec from 'k6/execution';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const faultWindowDuration = new Trend('fault_window_duration');

export const options = {
  scenarios: {
    perfil_comun_v1: {
      executor: 'ramping-vus',
      startVUs: 0,
      gracefulRampDown: '10s',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '60s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '180s', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    fault_window_duration: ['p(95)<800'],
  },
};

export default function flujo() {
  const elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  const inFault = elapsed >= 150 && elapsed < 270;
  const headers = {};
  if (inFault) headers['x-peer-latency-ms'] = '2000';
  if (__ENV.PEER_RESILIENCE === '1') headers['x-peer-resilience'] = 'true';

  const response = http.get(`${__ENV.API_URL}/api/v5/flujo`, { headers, timeout: '10s' });
  check(response, { 'flujo responds': (r) => r.status === 200 });
  if (inFault) faultWindowDuration.add(response.timings.duration);
  sleep(0.5);
}
