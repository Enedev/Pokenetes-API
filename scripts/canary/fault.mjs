import { pathToFileURL } from 'node:url';
import { log, outputs } from './lib.mjs';

export async function setFault(baseUrl, fault) {
  const headers = { 'content-type': 'application/json', 'x-canary': 'true' };
  if (process.env.FAULT_TOKEN) headers['x-fault-token'] = process.env.FAULT_TOKEN;

  const response = await fetch(`${baseUrl}/api/v3/fault`, {
    method: fault ? 'PUT' : 'DELETE',
    headers,
    body: fault ? JSON.stringify(fault) : undefined,
  });
  if (!response.ok) throw new Error(`fault endpoint answered ${response.status}`);
  return response.json();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, value] = process.argv.slice(2);
  const fault =
    mode === 'error' ? { error_rate: Number(value ?? 0.3) }
    : mode === 'latency' ? { latency_ms: Number(value ?? 1500) }
    : undefined;

  log('fault', await setFault(outputs().apiUrl, fault));
}
