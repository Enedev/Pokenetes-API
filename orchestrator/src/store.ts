import pg from 'pg';
import { FlujoMessage } from './types';

const flujos = new Map<string, FlujoMessage>();
let pool: pg.Pool | undefined;
let tableReady: Promise<void> | undefined;

function database(): pg.Pool | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

async function ensureTable(client: pg.Pool): Promise<void> {
  if (!tableReady) {
    tableReady = client
      .query(`CREATE TABLE IF NOT EXISTS flujo (
        trace_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
      .then(() => undefined);
  }
  await tableReady;
}

export async function saveFlujo(message: FlujoMessage): Promise<FlujoMessage> {
  flujos.set(message.trace_id, message);
  const client = database();
  if (!client) return message;

  await ensureTable(client);
  await client.query(
    `INSERT INTO flujo (trace_id, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (trace_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [message.trace_id, JSON.stringify(message)],
  );
  return message;
}

export async function getFlujo(traceId: string): Promise<FlujoMessage | undefined> {
  const cached = flujos.get(traceId);
  if (cached) return cached;

  const client = database();
  if (!client) return undefined;

  await ensureTable(client);
  const result = await client.query('SELECT payload FROM flujo WHERE trace_id = $1', [traceId]);
  const payload = result.rows[0]?.payload as FlujoMessage | undefined;
  if (!payload) return undefined;
  flujos.set(traceId, payload);
  return payload;
}

export async function listFlujos(): Promise<FlujoMessage[]> {
  const client = database();
  if (!client) return [...flujos.values()];

  await ensureTable(client);
  const result = await client.query('SELECT payload FROM flujo ORDER BY updated_at DESC');
  return result.rows.map((row) => row.payload as FlujoMessage);
}

export function clearFlujos(): void {
  flujos.clear();
}
