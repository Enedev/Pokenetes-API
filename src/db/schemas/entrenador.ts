export const ENTRENADOR_TABLE = 'entrenador';

export const ENTRENADOR_DDL = `
CREATE TABLE IF NOT EXISTS ${ENTRENADOR_TABLE} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export interface EntrenadorRecord {
  id?: string;
  nombre: string;
  region?: string;
  created_at?: string;
}
