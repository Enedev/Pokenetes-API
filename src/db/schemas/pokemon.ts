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

export interface PokemonRecord {
  id?: string;
  nombre: string;
  tipo: string;
  nivel?: number;
  created_at?: string;
}
