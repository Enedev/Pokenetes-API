export const POKEMON_TABLE = 'pokemon';

export const POKEMON_DDL = `
CREATE TABLE IF NOT EXISTS ${POKEMON_TABLE} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const POKEMON_APODO_MAX = 50;

export const POKEMON_APODO_DDL = `
ALTER TABLE ${POKEMON_TABLE} ADD COLUMN IF NOT EXISTS apodo VARCHAR(${POKEMON_APODO_MAX});
`;

export const POKEMON_V2_COLUMNS = ['id', 'nombre', 'tipo', 'nivel', 'created_at'] as const;

export const POKEMON_V3_COLUMNS = ['id', 'nombre', 'apodo', 'tipo', 'nivel', 'created_at'] as const;

export interface PokemonRecord {
  id?: string;
  nombre: string;
  apodo?: string | null;
  tipo: string;
  nivel?: number;
  created_at?: string;
}
