import dotenv from 'dotenv';
import path from 'path';

export interface OrchestratorEnv {
  PORT: number;
  NODE_ENV: string;
  POKENETES_API_URL: string;
  BIBLIO_API_URL?: string;
  BIBLIO_LAST_PATH: string;
  BIBLIO_LIST_PATH: string;
  HOSPITALINE_API_URL?: string;
  HOSPITALINE_LAST_PATH: string;
  HOSPITALINE_LIST_PATH: string;
  AWS_SQS_QUEUE_URL?: string;
}

export function loadOrchestratorEnv(): OrchestratorEnv {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  return {
    PORT: Number(process.env.ORCHESTRATOR_PORT ?? process.env.PORT ?? 3001),
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    POKENETES_API_URL: process.env.POKENETES_API_URL ?? 'http://127.0.0.1:3000',
    BIBLIO_API_URL: process.env.BIBLIO_API_URL,
    BIBLIO_LAST_PATH: process.env.BIBLIO_LAST_PATH ?? '/api/v2/books/last',
    BIBLIO_LIST_PATH: process.env.BIBLIO_LIST_PATH ?? '/api/books',
    HOSPITALINE_API_URL: process.env.HOSPITALINE_API_URL,
    HOSPITALINE_LAST_PATH: process.env.HOSPITALINE_LAST_PATH ?? '/api/v2/hospitals/last',
    HOSPITALINE_LIST_PATH: process.env.HOSPITALINE_LIST_PATH ?? '/api/v1/hospitals',
    AWS_SQS_QUEUE_URL: process.env.AWS_SQS_QUEUE_URL,
  };
}
