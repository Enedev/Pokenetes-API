import type { FastifyInstance } from 'fastify';
import { APP_VERSION, PUBLIC_API_PREFIX, PUBLIC_API_VERSION } from '../config/version';
import type { Track } from '../config/release';

export function apiVersionOf(url: string): string {
  const path = url.split('?')[0];
  const explicit = /^\/api\/(v\d+)(?:\/|$)/.exec(path);
  if (explicit) return explicit[1];
  if (path === PUBLIC_API_PREFIX || path.startsWith(`${PUBLIC_API_PREFIX}/`)) return PUBLIC_API_VERSION;
  return 'v1';
}

export function tagResponses(app: FastifyInstance, track: Track): void {
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-App-Version', APP_VERSION);
    reply.header('X-App-Track', track);
    reply.header('X-Api-Version', apiVersionOf(request.url));
    return payload;
  });
}
