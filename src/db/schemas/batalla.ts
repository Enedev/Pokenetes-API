export const BATALLA_TABLE = 'batalla';

export const BATALLA_DDL = `
CREATE TABLE IF NOT EXISTS ${BATALLA_TABLE} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pokemon_id UUID NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  entrenador_id UUID NOT NULL REFERENCES entrenador(id) ON DELETE CASCADE,
  resultado VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export interface BatallaRecord {
  id?: string;
  pokemon_id: string;
  entrenador_id: string;
  resultado?: string;
  created_at?: string;
}
