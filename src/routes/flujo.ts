import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { API_V2_PREFIX, contractVersionOf } from '../config/version';
import { LATENCY_TARGET_PEER, peerLatencyMs } from '../chaos/outbound-latency';
import { fetchLastLocalRecord } from '../db/last';
import { getSupabaseClient } from '../db/client';
import { POKEMON_V2_COLUMNS } from '../db/schemas/pokemon';
import { apiVersionOf } from '../http/release';
import { v2TraceFields } from '../http/trace';
import { fetchPeerLast, FetchLike, PeerRecord } from '../integrations/peer-client';
import { applyShape, pickColumns, Shape } from './shape';

export async function flujoRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
  prefix = API_V2_PREFIX,
  pokemonShape: Shape = pickColumns(POKEMON_V2_COLUMNS),
  fetchImpl?: FetchLike,
): Promise<void> {
  const db = () => supabaseClient ?? getSupabaseClient(env);
  const version = contractVersionOf(apiVersionOf(prefix));

  app.get(`${prefix}/flujo`, async (request, reply) => {
    const trace = v2TraceFields(request);
    const traceId = trace['x-trace_id'];
    const header = request.headers['x-peer-latency-ms'];
    const latencyMs = peerLatencyMs(Array.isArray(header) ? header[0] : header, env.PEER_LATENCY_MS);

    const local = await fetchLastLocalRecord(db(), 'pokemon');
    if (local.error) {
      return reply.status(500).send({ error: local.error, ...trace });
    }

    const book = await fetchPeerLast({
      api: 'biblio-express',
      entity: 'books',
      baseUrl: env.BIBLIO_API_URL,
      lastPath: env.BIBLIO_LAST_PATH,
      listPath: env.BIBLIO_LIST_PATH,
      traceId,
      fetchImpl,
      latencyMs,
    });
    const hospital = await fetchPeerLast({
      api: 'hospitaline',
      entity: 'hospitals',
      baseUrl: env.HOSPITALINE_API_URL,
      lastPath: env.HOSPITALINE_LAST_PATH,
      listPath: env.HOSPITALINE_LIST_PATH,
      traceId,
      fetchImpl,
    });

    const pokemon: PeerRecord = {
      api: 'pokenetes',
      source: `${prefix}/pokemon/last`,
      entity: 'pokemon',
      live: true,
      data: applyShape(local.data, pokemonShape),
    };

    return reply.status(200).send({
      api: 'pokenetes',
      version,
      ...trace,
      entry: 'aws',
      order: ['pokemon', 'books', 'hospitals'],
      latency_ms: latencyMs,
      latency_target: latencyMs > 0 ? LATENCY_TARGET_PEER : null,
      steps: [pokemon, book, hospital],
    });
  });
}
