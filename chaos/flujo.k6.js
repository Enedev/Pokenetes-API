import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 4,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
  },
};

export default function flujo() {
  const headers = {};
  if (__ENV.PEER_LATENCY_MS) headers['x-peer-latency-ms'] = __ENV.PEER_LATENCY_MS;
  if (__ENV.PEER_RESILIENCE === '1') headers['x-peer-resilience'] = 'true';

  const response = http.get(`${__ENV.API_URL}/api/v2/flujo`, { headers });
  check(response, { 'flujo responds': (r) => r.status === 200 });
}
