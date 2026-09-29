import fs from 'node:fs';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const tables = [
  { file: process.argv[2], table: 'pokemon', columns: ['id', 'nombre', 'tipo', 'nivel', 'created_at'] },
  { file: process.argv[3], table: 'entrenador', columns: ['id', 'nombre', 'region', 'created_at'] },
  { file: process.argv[4], table: 'batalla', columns: ['id', 'pokemon_id', 'entrenador_id', 'resultado', 'created_at'] },
];

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

for (const spec of tables) {
  const rows = JSON.parse(fs.readFileSync(spec.file, 'utf8'));
  if (!Array.isArray(rows)) {
    throw new Error(`${spec.file} is not a JSON array`);
  }

  for (const row of rows) {
    const columns = spec.columns.filter((column) => row[column] !== undefined);
    const values = columns.map((column) => row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const sql = `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
    await client.query(sql, values);
  }

  console.log(`${spec.table}: ${rows.length} rows`);
}

await client.end();
